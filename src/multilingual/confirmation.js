// Native confirm() localizes its buttons using the browser/OS locale, which
// can differ from the app. Keep the entire confirmation in the app locale.
export function createConfirmation({document=globalThis.document,translate=value=>value}={}) {
  let pending=false;
  return function confirmAction(message,{confirmLabel='続ける',cancelLabel='キャンセル'}={}) {
    if(pending)return Promise.resolve(false);
    pending=true;
    const previousFocus=document.activeElement;
    const dialog=document.createElement('dialog');
    dialog.id='appConfirmDialog';dialog.className='app-confirm-dialog';
    dialog.setAttribute('role','alertdialog');
    dialog.setAttribute('aria-labelledby','appConfirmTitle');
    dialog.setAttribute('aria-describedby','appConfirmMessage');
    const title=document.createElement('h2');title.id='appConfirmTitle';title.textContent=translate('確認');
    const body=document.createElement('p');body.id='appConfirmMessage';body.textContent=translate(message);
    const actions=document.createElement('div');actions.className='app-confirm-actions';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='outline-button';cancel.textContent=translate(cancelLabel);
    const accept=document.createElement('button');accept.type='button';accept.className='primary-button';accept.textContent=translate(confirmLabel);
    actions.append(cancel,accept);dialog.append(title,body,actions);document.body.append(dialog);
    return new Promise(resolve=>{
      let settled=false;
      function finish(accepted){
        if(settled)return;settled=true;pending=false;
        if(dialog.open)dialog.close();
        dialog.remove();
        if(previousFocus?.isConnected)previousFocus.focus();
        resolve(accepted);
      }
      cancel.addEventListener('click',()=>finish(false));
      accept.addEventListener('click',()=>finish(true));
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      dialog.addEventListener('close',()=>finish(false));
      try{dialog.showModal();cancel.focus();}
      catch(error){console.error('Confirmation unavailable:',error);finish(false);}
    });
  };
}
