declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// GIFs das notas de versão: o Vite empacota e devolve a URL do arquivo.
declare module '*.gif' {
  const src: string
  export default src
}
