import { useLayoutEffect, useRef } from "react";

export function Marquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const halves = Array.from(trackRef.current!.children) as HTMLElement[];
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const phone = matchMedia("(max-width: 660px)");
    let animations: Animation[] = [];
    let width = 0;
    let speed = 0;

    const update = () => {
      const nextWidth = halves[0].getBoundingClientRect().width;
      const nextSpeed = phone.matches ? 64 : 16;
      if (reducedMotion.matches) {
        animations.forEach((animation) => animation.cancel());
        animations = [];
        return;
      }
      if (
        !nextWidth ||
        (animations.length && width === nextWidth && speed === nextSpeed)
      ) return;

      // Keep the visible phase when resizing or when the web font arrives.
      const distance = (Number(animations[0]?.currentTime ?? 0) * speed) / 1000;
      animations.forEach((animation) => animation.cancel());
      width = nextWidth;
      speed = nextSpeed;
      const halfDuration = (width / speed) * 1000;
      const elapsed = ((distance % width) / speed) * 1000;
      const startTime = Number(document.timeline.currentTime) - elapsed;

      animations = halves.map((half, index) => {
        // The two halves share a clock. Each wraps only outside the window;
        // Web Animations don't dispatch CSS animationiteration events to React.
        const animation = half.animate(
          [
            { transform: "translateX(100%)" },
            { transform: "translateX(-100%)" },
          ],
          {
            duration: halfDuration * 2,
            delay: index === 0 ? -halfDuration : 0,
            iterations: Infinity,
            easing: "linear",
          },
        );
        animation.startTime = startTime;
        return animation;
      });
    };

    const observer = new ResizeObserver(update);
    observer.observe(halves[0]);
    reducedMotion.addEventListener("change", update);
    phone.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", update);
      phone.removeEventListener("change", update);
      animations.forEach((animation) => animation.cancel());
    };
  }, []);

  return (
    <div className="marquee">
      <div aria-hidden="true" className="marquee-window">
        <div className="marquee-track" ref={trackRef}>
          {[0, 1].map((half) => (
            <div className="marquee-half" key={half}>
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i}>
                  Basket buddies! • Take a stroll down the aisles • Give your cart a twirl •{" "}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Manifest order; repeated, static rows cover even the widest supported frame.
const shelves = [
  [
    "art/food/bread.svg",
    "art/food/baguette.svg",
    "art/food/cheese.svg",
    "art/food/milk.svg",
    "art/food/canned-food.svg",
    "art/food/egg.svg",
    "art/food/honey-pot.svg",
    "art/food/jar.svg",
    "art/food/beverage-box.svg",
    "art/food/croissant.svg",
    "art/food/butter.svg",
    "art/food/cookie.svg",
    "art/food/pie.svg",
    "art/food/bagel.svg"
  ],
  [
    "art/food/apple.svg",
    "art/food/banana.svg",
    "art/food/carrot.svg",
    "art/food/broccoli.svg",
    "art/food/tomato.svg",
    "art/food/pineapple.svg",
    "art/food/corn.svg",
    "art/food/bell-pepper.svg",
    "art/food/leafy-green.svg",
    "art/food/watermelon.svg",
    "art/food/grapes.svg",
    "art/food/lemon.svg",
    "art/food/pear.svg",
    "art/food/strawberry.svg",
    "art/food/eggplant.svg",
    "art/food/avocado.svg",
    "art/food/onion.svg",
    "art/food/potato.svg",
    "art/food/green-apple.svg"
  ]
];
export function StoreShelf() {
  return (
    <div className="store-shelf" aria-hidden="true">
      {shelves.map((foods, row) => (
        <div className="shelf-row" key={row}>
          {Array.from({ length: 5 }, (_, repeat) =>
            foods.map((path) => (
              <img key={`${repeat}-${path}`} src={`./${path}`} width="40" height="40" alt="" />
            )),
          )}
        </div>
      ))}
    </div>
  );
}
