// Lista de projetos: o endereço abre as linhas de um grupo (#automacao, #3d, #estudo) ou uma linha (#<id>).
(() => {
  const rows = [...document.querySelectorAll('.pj-linha')];
  if (rows.length) {
    // #automacao, #3d e #estudo (destinos da inicial, de /jogos/ e de /estudos/) abrem as linhas do grupo;
    // #<id> abre só aquela linha.
    const open = () => {
      // Um endereço malformado (por exemplo, #%E0%A4%A) não pode virar erro na página.
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      if (!id) return;
      const grouped = rows.filter(row => row.dataset.grupo === id);
      const targets = grouped.length ? grouped : rows.filter(row => row.id === id);
      targets.forEach(row => { row.open = true; });
      // O grupo rola até a âncora dele; sem a âncora, até a primeira linha do grupo.
      if (targets.length) (grouped.length ? document.getElementById(id) || grouped[0] : targets[0]).scrollIntoView({ block: 'start' });
    };
    window.addEventListener('hashchange', open);
    open();
  }
})();
