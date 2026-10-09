export function Marquee() {
  return (
    <div className="marquee">
      <div aria-hidden="true" className="marquee-window">
        <div className="marquee-track">
          {[0, 1].map((half) => (
            <div className="marquee-half" key={half}>
              {Array.from({ length: 4 }, (_, i) => (
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
