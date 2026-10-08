import { useId, useState } from "react";
export function Marquee() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={"marquee " + (paused ? "paused" : "")}>
      <div aria-hidden="true" className="marquee-window">
        <div className="marquee-track">
          <span>
            Basket buddies! • Take a stroll down the aisles • Give your cart a
            twirl • Basket buddies! • Take a stroll down the aisles • Give your
            cart a twirl •{" "}
          </span>
          {Array.from({ length: 7 }, (_, i) => (
            <span className="desktop-slogans" key={i}>
              Basket buddies! • Take a stroll down the aisles • Give your cart a
              twirl • Basket buddies! • Take a stroll down the aisles • Give
              your cart a twirl •{" "}
            </span>
          ))}
        </div>
      </div>
      <button
        aria-label={
          paused ? "Resume shopping marquee" : "Pause shopping marquee"
        }
        onClick={() => setPaused(!paused)}
      >
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}
export function StoreShelf() {
  const id = useId();
  return (
    <svg className="store-shelf" height="55" aria-hidden="true">
      <defs>
        <pattern
          id={id}
          width="150"
          height="90"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(.55)"
        >
          <rect
            x="7"
            y="20"
            width="30"
            height="54"
            rx="2"
            fill="#ffda28"
            stroke="#193a78"
            strokeWidth="3"
          />
          <path d="M12 32h20M12 61h20" stroke="#fff" strokeWidth="7" />
          <rect
            x="46"
            y="40"
            width="25"
            height="34"
            rx="5"
            fill="#e5252a"
            stroke="#193a78"
            strokeWidth="3"
          />
          <ellipse cx="58" cy="40" rx="12" ry="4" fill="#fff" />
          <path
            d="M87 30V15h16v15l9 12v31H78V42Z"
            fill="#53ae62"
            stroke="#193a78"
            strokeWidth="3"
          />
          <path d="M79 48h31v14H79" fill="#fff" />
          <rect
            x="120"
            y="29"
            width="24"
            height="45"
            fill="#fff"
            stroke="#193a78"
            strokeWidth="3"
          />
          <path d="M123 40h18M123 49h18" stroke="#2857bd" strokeWidth="4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#c4e7ff" />
      <rect width="100%" height="80%" fill={`url(#${id})`} />
      <rect y="80%" width="100%" height="13%" fill="#ffe029" />
      <rect y="93%" width="100%" height="7%" fill="#e5252a" />
    </svg>
  );
}
export function Clerk() {
  return (
    <svg
      viewBox="0 0 300 290"
      className="clerk"
      role="img"
      aria-label="An original smiling store clerk with a bow tie beside a produce crate"
    >
      <path
        d="M29 282v-38q0-56 54-63h54q51 8 51 63v38"
        fill="#fff"
        stroke="#143a79"
        strokeWidth="5"
      />
      <path
        d="m68 186 18 56h57l17-57 17 27-11 70H54l-8-72Z"
        fill="#1752c5"
        stroke="#143a79"
        strokeWidth="5"
      />
      <path
        d="M84 162h54v43H84Z"
        fill="#e9a875"
        stroke="#143a79"
        strokeWidth="5"
      />
      <ellipse
        cx="112"
        cy="105"
        rx="58"
        ry="71"
        fill="#ffc994"
        stroke="#143a79"
        strokeWidth="5"
      />
      <path
        d="M56 97Q28 45 76 28q32-27 69 3 41-1 29 54l-27-15q-19 12-33-6-13 20-54 21"
        fill="#84372a"
        stroke="#143a79"
        strokeWidth="5"
      />
      <path
        d="M64 34q43-32 81 0l7 15H59Z"
        fill="#fff"
        stroke="#143a79"
        strokeWidth="5"
      />
      <path d="M60 46h93" stroke="#e5252a" strokeWidth="12" />
      <ellipse cx="90" cy="105" rx="5" ry="7" fill="#143a79" />
      <ellipse cx="135" cy="105" rx="5" ry="7" fill="#143a79" />
      <path
        d="m110 106-5 18h12M87 139q24 25 49-1"
        fill="none"
        stroke="#143a79"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="m111 201-27-15v34l27-11 27 11v-34Z"
        fill="#e5252a"
        stroke="#143a79"
        strokeWidth="4"
      />
      <circle
        cx="111"
        cy="204"
        r="7"
        fill="#ffda28"
        stroke="#143a79"
        strokeWidth="3"
      />
      <path
        d="M169 204 Q187 223 202 189 L214 164
        Q228 160 232 148 L237 132 Q239 125 233 125 L226 141
        L226 112 Q224 104 220 111 L217 137 L212 106 Q208 100 205 107
        L207 136 L199 116 Q194 112 193 119 L199 143
        L189 134 Q181 133 185 141 L199 162 L185 187 L174 183 Z"
        fill="#ffc994"
        stroke="#143a79"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M200 161 Q207 167 214 164"
        fill="none"
        stroke="#143a79"
        strokeWidth="3"
      />
      <path
        d="M196 225q8-32 27-8 13-40 34-7 30-18 28 22"
        fill="#4caa57"
        stroke="#143a79"
        strokeWidth="4"
      />
      <circle cx="219" cy="231" r="17" fill="#ffb026" />
      <circle cx="260" cy="228" r="17" fill="#e5252a" />
      <path
        d="M184 232h109v51H184Z"
        fill="#efb672"
        stroke="#143a79"
        strokeWidth="5"
      />
      <path d="M189 247h100M189 267h100" stroke="#8d4d28" strokeWidth="5" />
    </svg>
  );
}
// Original line art: goods rest on the belt; people stand behind the counter.
export function Checkout({ redeem = false }: { redeem?: boolean }) {
  return (
    <svg
      className="checkout"
      viewBox="0 0 400 210"
      role="img"
      aria-label={
        redeem
          ? "A cashier handing a full grocery bag across the counter"
          : "A shopper unloading a basket onto the checkout belt"
      }
    >
      <path
        d="M25 188V92q0-28 34-28h28q34 0 34 28v96"
        fill={redeem ? "#1752c5" : "#e5252a"}
        stroke="#17356b"
        strokeWidth="4"
      />
      <ellipse
        cx="73"
        cy="40"
        rx="25"
        ry="30"
        fill="#ffc994"
        stroke="#17356b"
        strokeWidth="4"
      />
      <path
        d="M48 34Q40 6 69 6q33-8 33 27L83 23 65 30Z"
        fill="#84372a"
        stroke="#17356b"
        strokeWidth="3"
      />
      <path
        d="M64 42h1m17 0h1M66 53q8 8 16-1"
        fill="none"
        stroke="#17356b"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="8"
        y="144"
        width="384"
        height="57"
        rx="8"
        fill="#ffdb29"
        stroke="#17356b"
        strokeWidth="4"
      />
      <rect
        x="15"
        y="137"
        width="370"
        height="22"
        rx="11"
        fill="#778898"
        stroke="#17356b"
        strokeWidth="4"
      />
      {redeem ? (
        <>
          <path
            d="M246 144V64q0-21 20-21h34q20 0 20 21v80"
            fill="#53ae62"
            stroke="#17356b"
            strokeWidth="4"
          />
          <ellipse
            cx="283"
            cy="24"
            rx="21"
            ry="22"
            fill="#b9794e"
            stroke="#17356b"
            strokeWidth="4"
          />
          <path
            d="M150 78h66l-5 65h-54Z"
            fill="#efb672"
            stroke="#17356b"
            strokeWidth="4"
          />
          <path
            d="M165 82V63q18-26 34 0v19"
            fill="none"
            stroke="#17356b"
            strokeWidth="5"
          />
          <path
            d="M168 79l-8-37q-2-14 7-14t11 15l6 36"
            fill="#ffdb29"
            stroke="#17356b"
            strokeWidth="3"
          />
          <path
            d="M188 78q-18-26-2-29 4-17 14-8 22-5 16 12 10 11-9 25"
            fill="#53ae62"
            stroke="#17356b"
            strokeWidth="3"
          />
          <path
            d="M108 86l23 24 26 2m-49-26 27 14 22 12M253 82l-22 27-16 1"
            fill="none"
            stroke="#17356b"
            strokeWidth="17"
            strokeLinecap="round"
          />
          <path
            d="M108 86l25 19 24 7M253 82l-22 27-16 1"
            fill="none"
            stroke="#ffc994"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M109 81l36 9 32 32"
            fill="none"
            stroke="#17356b"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M109 81l36 9 32 32"
            fill="none"
            stroke="#ffc994"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <rect
            x="164"
            y="99"
            width="29"
            height="36"
            rx="3"
            fill="#ffdb29"
            stroke="#17356b"
            strokeWidth="4"
          />
          <path
            d="M247 100V74h16v26l9 12v23h-34v-23Z"
            fill="#53ae62"
            stroke="#17356b"
            strokeWidth="4"
          />
          <path
            d="M292 99h83l-9 36h-66Z"
            fill="#e5252a"
            stroke="#17356b"
            strokeWidth="4"
          />
          <path
            d="M307 99l17-27m35 27-16-27m-32 38v13m19-13v13m19-13v13"
            stroke="#17356b"
            strokeWidth="4"
          />
          <path
            d="M315 94q-9-30 7-29 4-15 14-2 19-4 17 17"
            fill="#53ae62"
            stroke="#17356b"
            strokeWidth="3"
          />
        </>
      )}
    </svg>
  );
}
