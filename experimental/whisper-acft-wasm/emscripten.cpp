// Research-only browser bindings for whisper.cpp + FUTO ACFT Small.
// Based on ggml-org/whisper.cpp examples/whisper.wasm/emscripten.cpp (MIT).
// The important difference is exposing params.audio_ctx (250=5s, 500=10s)
// and explicit completion, segment text and native encoder/decoder timings.
// Entire inference is local. Never send a user's audio to the server.
#include "whisper.h"
#include <emscripten.h>
#include <emscripten/bind.h>
#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <string>
#include <thread>
#include <vector>

namespace {
std::thread worker;
whisper_context * context = nullptr;
std::atomic<bool> running(false);
std::atomic<bool> finished(false);
std::atomic<int> run_result(-1);

int thread_count(int requested) {
    unsigned available = std::thread::hardware_concurrency();
    int limit = available ? (int) available : 4;
    return std::max(1,std::min(std::min(requested,limit),8));
}
void join_completed() {
    if (worker.joinable() && !running.load()) worker.join();
}
} // namespace

EMSCRIPTEN_BINDINGS(acft_research) {
    emscripten::function("acft_init", emscripten::optional_override([](const std::string & model_path) {
        if (running.load()) return false;
        join_completed();
        if (context != nullptr) {
            whisper_free(context);
            context = nullptr;
        }
        context=whisper_init_from_file_with_params(model_path.c_str(),whisper_context_default_params());
        finished.store(false);
        run_result.store(-1);
        return context != nullptr;
    }));

    emscripten::function("acft_run", emscripten::optional_override([](
        const emscripten::val & input,
        const std::string & language,
        int nthreads,
        int audio_ctx) {
        if (context == nullptr) return -1;
        if (running.load()) return -2;
        join_completed();
        if (audio_ctx < 100 || audio_ctx > whisper_n_audio_ctx(context)) return -3;
        const int n = input["length"].as<int>();
        if (n <= 0 || n > 16000*11) return -4;
        // 5s/10s context: fail rather than silently truncating a long utterance.
        if (n > audio_ctx*320) return -5;

        std::vector<float> samples(n);
        emscripten::val heap=emscripten::val::module_property("HEAPU8");
        emscripten::val memory=heap["buffer"];
        emscripten::val memoryView=input["constructor"].new_(
            memory,reinterpret_cast<uintptr_t>(samples.data()),n);
        memoryView.call<void>("set",input);

        whisper_full_params params=whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        params.print_realtime=false;
        params.print_progress=false;
        params.print_timestamps=false;
        params.print_special=false;
        params.translate=false;
        params.n_threads=thread_count(nthreads);
        params.audio_ctx=audio_ctx;
        params.no_context=true;
        params.max_tokens=96;
        params.offset_ms=0;
        params.language=language.c_str();
        // params.language must outlive the asynchronous worker.
        const std::string language_owned=language;
        running.store(true);
        finished.store(false);
        run_result.store(-1);
        worker=std::thread([samples=std::move(samples),params,language_owned]() mutable {
            params.language=language_owned.c_str();
            whisper_reset_timings(context);
            int code=whisper_full(context,params,samples.data(),(int) samples.size());
            run_result.store(code);
            finished.store(true);
            running.store(false);
        });
        return 0;
    }));

    emscripten::function("acft_status", emscripten::optional_override([](){
        if(running.load())return 0;
        if(!finished.load())return -1;
        join_completed();
        return run_result.load()==0?1:-2;
    }));

    emscripten::function("acft_result", emscripten::optional_override([](){
        if(running.load() || !finished.load() || run_result.load()!=0 || !context)return std::string("");
        join_completed();
        std::string out;
        const int segments=whisper_full_n_segments(context);
        for(int i=0;i<segments;i++) {
            const char * text=whisper_full_get_segment_text(context,i);
            if(text)out+=text;
        }
        return out;
    }));

    emscripten::function("acft_timings", emscripten::optional_override([](){
        if(running.load() || !finished.load() || run_result.load()!=0 || !context)return std::string("");
        join_completed();
        const whisper_timings * t=whisper_get_timings(context);
        if(!t)return std::string("");
        char info[240]={0};
        std::snprintf(info,sizeof(info),
          "{\"sampleMs\":%.2f,\"encodeMs\":%.2f,\"decodeMs\":%.2f,\"batchdMs\":%.2f,\"promptMs\":%.2f}",
          t->sample_ms,t->encode_ms,t->decode_ms,t->batchd_ms,t->prompt_ms);
        return std::string(info);
    }));

    emscripten::function("acft_free", emscripten::optional_override([](){
        if(running.load())return false;
        join_completed();
        if(context){whisper_free(context);context=nullptr;}
        finished.store(false);
        return true;
    }));
}
