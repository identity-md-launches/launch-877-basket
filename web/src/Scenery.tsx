import { useState } from "react";
export function Marquee() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={"marquee " + (paused ? "paused" : "")}>
      <div aria-hidden="true">
        <span>
          Basket buddies! • Take a stroll down the aisles • Give your cart a
          twirl • Basket buddies! • Take a stroll down the aisles • Give your
          cart a twirl •{" "}
        </span>
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
  return (
    <svg className="store-shelf" viewBox="0 0 900 100" aria-hidden="true">
      <defs>
        <pattern
          id="shelf-stock"
          width="150"
          height="90"
          patternUnits="userSpaceOnUse"
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
      <rect width="900" height="100" fill="#c4e7ff" />
      <rect width="900" height="80" fill="url(#shelf-stock)" />
      <path d="M0 80h900" stroke="#ffe029" strokeWidth="13" />
      <path d="M0 91h900" stroke="#e5252a" strokeWidth="10" />
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
        d="m171 201 33-49 12 13-13 49q-16 25-29 3"
        fill="#ffc994"
        stroke="#143a79"
        strokeWidth="5"
      />
      <path
        d="M205 157q-20-23-13-28l12 10q-10-36-1-36l13 32q-2-33 7-31l5 33q6-26 13-20l-5 30q20-11 21-3l-28 26"
        fill="#ffc994"
        stroke="#143a79"
        strokeWidth="4"
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
export function Checkout() {
  return (
    <svg className="checkout" viewBox="0 0 400 120" aria-hidden="true">
      <rect x="5" y="61" width="390" height="53" rx="20" fill="#17356b" />
      <rect x="15" y="70" width="370" height="28" rx="14" fill="#778898" />
      <path
        d="M56 75v20m44-20v20m44-20v20m44-20v20m44-20v20m44-20v20m44-20v20"
        stroke="#fff"
        strokeWidth="2"
      />
      <rect
        x="80"
        y="13"
        width="41"
        height="47"
        fill="#ffdb29"
        stroke="#17356b"
        strokeWidth="4"
      />
      <path
        d="M185 30V10h19v20l12 12v20h-43V42Z"
        fill="#50ad65"
        stroke="#17356b"
        strokeWidth="4"
      />
      <path
        d="m262 14 16 1 15 47h58l13-34h-82m12 46h56"
        fill="none"
        stroke="#17356b"
        strokeWidth="5"
      />
      <circle cx="300" cy="86" r="6" fill="#17356b" />
      <circle cx="345" cy="86" r="6" fill="#17356b" />
    </svg>
  );
}
