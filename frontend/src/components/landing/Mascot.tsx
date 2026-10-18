// Decorativa (alt vazio): o texto ao lado dá o sentido. "large" põe a versão de 1024 px no srcset.
export function Mascot({ name, sizes, large = false, className = '', lazy = false }: {
  name: string
  sizes: string
  large?: boolean
  className?: string
  lazy?: boolean
}) {
  const base = `/mascote/kliny-${name}`
  const set = (ext: string) => (large ? `${base}-512.${ext} 512w, ${base}-1024.${ext} 1024w` : `${base}-512.${ext} 512w`)
  return (
    <picture>
      <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
      <img
        src={`${base}-512.png`}
        srcSet={set('png')}
        sizes={sizes}
        alt=""
        width={512}
        height={512}
        loading={lazy ? 'lazy' : undefined}
        draggable={false}
        className={`select-none ${className}`}
      />
    </picture>
  )
}
