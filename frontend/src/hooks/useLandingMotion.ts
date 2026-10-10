import { useEffect, type RefObject } from 'react'
import { lerp, screenOffset, tourHeight, tourProgress } from '../lib/landingMotion'

const PARALLAX_PX = 220

interface LandingMotionRefs {
  // A toca da abertura: os filhos com data-parallax andam no eixo Y conforme ela passa pela tela.
  stage: RefObject<HTMLElement | null>
  // A seção de recursos e a trilha que anda de lado dentro dela.
  tour: RefObject<HTMLElement | null>
  track: RefObject<HTMLElement | null>
}

// Efeitos de rolagem da landing (8.6), com requestAnimationFrame e sem biblioteca. Com
// "reduzir movimento" ligado nada se mexe, e no celular a trilha vira uma rolagem lateral comum
// (data-static). Só mexe em transform, e só a cada rolagem ou enquanto a suavização não chega ao alvo.
export function useLandingMotion({ stage, tour, track }: LandingMotionRefs): void {
  useEffect(() => {
    const stageEl = stage.current, tourEl = tour.current, trackEl = track.current
    if (!stageEl || !tourEl || !trackEl) return

    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const narrow = matchMedia('(max-width: 639px)')
    const items = [...stageEl.querySelectorAll<HTMLElement>('[data-parallax]')]
      .map((el) => ({ el, strength: Number(el.dataset.parallax), y: 0 }))
    let frame = 0
    // Largura sem a barra de rolagem (innerWidth a inclui): senão o fim da trilha fica escondido atrás dela.
    const visibleWidth = () => document.documentElement.clientWidth

    function layout() {
      const isStatic = reduce.matches || narrow.matches
      tourEl!.toggleAttribute('data-static', isStatic)
      // Na rolagem lateral comum, a trilha recebe foco para andar com as setas do teclado.
      if (isStatic) trackEl!.setAttribute('tabindex', '0')
      else trackEl!.removeAttribute('tabindex')
      trackEl!.style.transform = ''
      tourEl!.style.height = isStatic ? '' : `${tourHeight(trackEl!.scrollWidth, visibleWidth(), innerHeight)}px`
      if (reduce.matches) for (const item of items) item.el.style.translate = ''
    }

    function tick() {
      frame = 0
      if (!tourEl!.hasAttribute('data-static')) {
        const progress = tourProgress(tourEl!.getBoundingClientRect().top, tourEl!.offsetHeight, innerHeight)
        trackEl!.style.transform = `translate3d(${-progress * Math.max(0, trackEl!.scrollWidth - visibleWidth())}px, 0, 0)`
      }
      if (reduce.matches) return
      const rect = stageEl!.getBoundingClientRect()
      const offset = screenOffset(rect.top, rect.height, innerHeight)
      let moving = false
      for (const item of items) {
        const target = offset * item.strength * PARALLAX_PX
        item.y = lerp(item.y, target)
        if (Math.abs(target - item.y) > 0.3) moving = true
        // translate (e não transform), para não brigar com o transform da flutuação e da centralização.
        item.el.style.translate = `0 ${item.y.toFixed(2)}px`
      }
      if (moving) request()
    }

    function request() {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    function relayout() {
      layout()
      request()
    }

    addEventListener('scroll', request, { passive: true })
    addEventListener('resize', relayout)
    reduce.addEventListener('change', relayout)
    narrow.addEventListener('change', relayout)
    // A largura da trilha muda quando a fonte dos títulos termina de carregar.
    document.fonts?.ready.then(relayout)
    relayout()

    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('scroll', request)
      removeEventListener('resize', relayout)
      reduce.removeEventListener('change', relayout)
      narrow.removeEventListener('change', relayout)
      tourEl.style.height = ''
      trackEl.style.transform = ''
    }
  }, [stage, tour, track])
}
