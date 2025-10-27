// js/admin.confirm.js
(function (w, d) {
  var modal = d.querySelector('#modal');
  var textEl = d.querySelector('#modalText');
  var okBtn = d.querySelector('#modalOk');
  var cancelBtn = d.querySelector('#modalCancel');

  var toasts = d.querySelector('#toasts');
  if (!toasts) {
    toasts = d.createElement('div');
    toasts.id = 'toasts';
    toasts.className = 'toasts';
    d.body.appendChild(toasts);
  }

  function toast(msg, type) {
    var el = d.createElement('div');
    el.className = 'toast ' + (type === 'err' ? 'toast--err' : 'toast--ok');
    el.textContent = msg;
    toasts.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  function confirmDo(message) {
    if (!modal || !textEl || !okBtn || !cancelBtn) {
      return Promise.resolve(window.confirm(message));
    }
    return new Promise(function (resolve) {
      textEl.textContent = message;
      modal.hidden = false;

      function onOk(e){ e.preventDefault(); cleanup(); resolve(true); }
      function onCancel(e){ e && e.preventDefault(); cleanup(); resolve(false); }
      function onKey(e){ if (e.key === 'Escape') onCancel(e); }
      function onBackdrop(e){ if (e.target === modal) onCancel(e); }
      function cleanup(){
        modal.hidden = true;
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        window.removeEventListener('keydown', onKey);
        modal.removeEventListener('click', onBackdrop);
      }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      window.addEventListener('keydown', onKey);
      modal.addEventListener('click', onBackdrop);
      setTimeout(function(){ okBtn.focus(); }, 0);
    });
  }

  w.Confirm = { ask: confirmDo };
  w.Toast   = { ok: t => toast(t,'ok'), err: t => toast(t,'err') };
})(window, document);
