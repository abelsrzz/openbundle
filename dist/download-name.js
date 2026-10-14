// Selected applications determine the EXE filename, in installation order.
export function installerFileName(items) {
  const names = items.map(item => item.name.normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'Aplicacion');
  return 'OpenBundle_' + (names.join('_') || 'Instalador') + '.exe';
}
