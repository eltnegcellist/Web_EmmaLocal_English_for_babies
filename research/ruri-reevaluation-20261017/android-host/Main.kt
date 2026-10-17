package com.eltnegcellist.emma.ai

// Research-only Mac JVM host. Uses the Android tokenizer and reply engine sources
// unchanged. The linear math mirrors RuriSemanticClassifier, including Float
// multiplication followed by Double accumulation. This is NOT an Android device.
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.LongBuffer
import kotlin.math.exp
import org.json.JSONArray
import org.json.JSONObject

private val topics = listOf("drink","bath","milk","sleep","wake","diaper","clothes","hug","hands","feet","smile","cry","voice","tummy","play","outside","rain","sun","food","book","music","generic")
private val interactions = listOf("affection","praise","achievement","effort","encouragement","invitation","start","finish","finish_check","care","inquiry","reassurance","repeat","pause","none")
private data class Score(val raw: String, val p: Double, val margin: Double, val probabilities: DoubleArray) {
 fun json() = JSONObject().put("rawId",raw).put("probability",p).put("margin",margin).put("probabilities",JSONArray(probabilities.toList()))
}
private fun head(file: File): FloatArray {
 val bytes=file.readBytes();val view=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
 return FloatArray(view.remaining()).also(view::get)
}
private fun classify(e: FloatArray,w: FloatArray,labels: List<String>): Score {
 val logits=DoubleArray(labels.size){c->var v=w[c*385+384].toDouble();for(i in 0 until 384)v+=w[c*385+i]*e[i];v}
 val max=logits.maxOrNull()!!;val p=DoubleArray(labels.size){exp(logits[it]-max)};val sum=p.sum()
 for(i in p.indices)p[i]/=sum
 val rank=p.indices.sortedByDescending{p[it]}
 return Score(labels[rank[0]],p[rank[0]],p[rank[0]]-p[rank[1]],p)
}
fun main(args: Array<String>) {
 val webRoot=File(args[0]);val output=File(args[1]);val assets=File(webRoot,"semantic-assets/ruri70-int8-bd500193")
 val input=JSONObject(File(webRoot,".semantic-research/android-web-input.json").readText()).getJSONArray("cases")
 val tokenizer=RuriSemanticTokenizer(File(assets,"tokenizer.json"))
 val th=head(File(assets,"head-topic.f32"));val ih=head(File(args[2],"app/src/main/assets/semantic/head-interaction.f32"))
 val rows=JSONArray();val env=OrtEnvironment.getEnvironment();val options=OrtSession.SessionOptions()
 env.createSession(File(assets,"model.onnx").absolutePath,options).use{session->
  for(index in 0 until input.length()) {
   val item=input.getJSONObject(index);val text=item.getString("text");val ids=tokenizer.encode(text)
   val e=OnnxTensor.createTensor(env,LongBuffer.wrap(ids),longArrayOf(1,ids.size.toLong())).use { tensor ->
    OnnxTensor.createTensor(env,LongBuffer.wrap(LongArray(ids.size){1}),longArrayOf(1,ids.size.toLong())).use { mask ->
     session.run(mapOf("input_ids" to tensor,"attention_mask" to mask)).use{out->
      val t=out.get("sentence_embedding").get() as OnnxTensor;val b=requireNotNull(t.floatBuffer);FloatArray(384).also(b::get)
     }
    }
   }
   val t=classify(e,th,topics);val i=classify(e,ih,interactions)
   val prediction=SemanticTopicPrediction(if(t.margin<.05)"generic" else t.raw,t.p,t.margin,interaction=i.raw,interactionProbability=i.p,interactionMargin=i.margin)
   val reply=LiteResponseEngine().respondRuri(text,"",prediction,true)
   val webIds=item.getJSONArray("tokenIds");val tokensMatch=ids.size==webIds.length()&&ids.indices.all{ids[it]==webIds.getLong(it)}
   rows.put(JSONObject().put("id",item.getString("id")).put("text",text).put("tokenIdsMatch",tokensMatch)
    .put("topic",t.json()).put("interaction",i.json()).put("route",reply.scene).put("english",reply.english).put("routingReason",reply.routingReason))
  }
 }
 options.close();output.parentFile.mkdirs()
 output.writeText(JSONObject().put("status","MAC_AARCH64_JVM_HOST_NOT_GALAXY_S25").put("runtime","onnxruntime-java-1.23.2").put("rows",rows).toString(2)+"\n")
 println("Native two-axis and actual Android reply engine completed: ${rows.length()} cases")
}
