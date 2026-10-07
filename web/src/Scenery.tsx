// Original geometric artwork. No item carries text, prices or currency.
export function Planet() {
  return <svg className="planet-sign" viewBox="0 0 120 100" aria-hidden="true" focusable="false">
    <circle cx="60" cy="49" r="31" fill="#ffe668" />
    <path d="M36 31q19-16 35 0M33 43q25-16 48 0M43 64q15 9 28 0" fill="none" stroke="#f6aa37" strokeWidth="4" />
    <ellipse cx="60" cy="52" rx="55" ry="16" transform="rotate(-25 60 52)" fill="none" stroke="#ffe668" strokeWidth="7" />
    <path d="m98 9 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#ff8fcf" />
  </svg>;
}
export function NightSky() {
  return <svg className="night-sky" viewBox="0 0 1440 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="beam" x2="0" y2="1"><stop stopColor="#a486eb" stopOpacity=".02"/><stop offset="1" stopColor="#a486eb" stopOpacity=".24"/></linearGradient>
      <linearGradient id="saucer" x2="0" y2="1"><stop stopColor="#ffdc8b"/><stop offset=".45" stopColor="#ff994d"/><stop offset="1" stopColor="#ef562e"/></linearGradient>
      <radialGradient id="awning-glow"><stop stopColor="#ff9254" stopOpacity=".32"/><stop offset="1" stopColor="#ff9254" stopOpacity="0"/></radialGradient>
      <pattern id="stars" width="173" height="113" patternUnits="userSpaceOnUse"><circle cx="17" cy="28" r="1.2" fill="#cbc4ed"/><circle cx="103" cy="80" r="1" fill="#dce6fb"/><path d="M136 29v8m-4-4h8" stroke="#7e7aa7"/></pattern>
    </defs>
    <path d="M600 260 790 -30 950 -30Z M740 260 100 -40 345 -40Z" fill="url(#beam)"/>
    <path d="M1110 260 520 -40 850 -40Z" fill="url(#beam)"/>
    <path d="M0 0h1440v260H0Z" fill="url(#stars)"/>
    <ellipse cx="835" cy="170" rx="400" ry="135" fill="url(#awning-glow)"/>
    <g transform="translate(600 60) rotate(-7 210 100)">
      <path d="M123 76q80-98 169 0" fill="#515272" stroke="#b6a3ef" strokeWidth="3"/>
      <path d="M145 65q66-58 123 0" fill="#22253d"/>
      <ellipse cx="210" cy="92" rx="193" ry="35" fill="url(#saucer)" stroke="#ffbf75" strokeWidth="3"/>
      <ellipse cx="210" cy="105" rx="144" ry="17" fill="#a54433" stroke="#ffbb6c" strokeWidth="4"/>
      <path d="M76 91q132 23 269 0" fill="none" stroke="#ffe1a1" strokeWidth="3"/>
      {[105,155,205,255,305].map(x=><ellipse key={x} cx={x} cy="111" rx="9" ry="3" fill="#ffe889"/>)}
    </g>
    <g transform="translate(465 42) rotate(-18)">
      <path d="M0 51-17 68-13 42 0 29 13 42 17 68Z" fill="#fc77bc"/>
      <path d="M-9 49Q-15 12 0 0q15 12 9 49Z" fill="#fcf4d7"/>
      <circle cy="24" r="6" fill="#42cabf" stroke="#161d36" strokeWidth="3"/>
      <path d="M-5 53 0 71 5 53" fill="#ffe668"/>
    </g>
  </svg>;
}
export function Storefront() {
  return <svg className="storefront" viewBox="0 0 520 360" aria-hidden="true" focusable="false">
    <defs>
      <pattern id="floor" width="40" height="24" patternUnits="userSpaceOnUse"><path d="M0 0h20v12H0Zm20 12h20v12H20Z" fill="#697586"/></pattern>
      <pattern id="glass-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0v28" fill="none" stroke="#519793" strokeWidth="1"/></pattern>
    </defs>
    <path d="m21 60 5-15 7 12 14-5-5 14 12 7-15 4 1 15-12-9-11 9 1-15-13-4 13-6Z" fill="#ec83c9"/>
    <path d="m460 82 17-19 17 19-17 19Z" fill="none" stroke="#d8f47a" strokeWidth="4"/>
    <path d="M26 298h454v35H26Z" fill="url(#floor)"/>
    <path d="m61 105 26-35h302l57 35v191H61Z" fill="#23454f" stroke="#7595a1" strokeWidth="3"/>
    <path d="M76 117h354v169H76Z" fill="#15323e"/>
    <path d="M76 117h354v169H76Z" fill="url(#glass-grid)"/>
    <path d="M55 90 390 64l67 43-402 12Z" fill="#ee9560" stroke="#ffc98d" strokeWidth="3"/>
    <path d="m58 109 391-13v21L58 130Z" fill="#ffe1a0"/>
    <path d="m81 108 27-1v21l-27 1Zm53-2 27-1v21l-27 1Zm53-2 27-1v21l-27 1Zm53-2 27-1v21l-27 1Zm53-2 27-1v21l-27 1Zm53-2 27-1v21l-27 1Zm53-2 27-1v21l-27 1Z" fill="#e86183"/>
    <g stroke="#1b293d" strokeWidth="2">
      <path d="M103 139h31v48h-31Z" fill="#ceee75"/><path d="M140 153h25v34h-25Z" fill="#c28bf1"/><path d="M172 133h32v54h-32Z" fill="#f18aca"/>
      <path d="m215 157 4-13h28l4 13v30h-36Z" fill="#f6cf60"/><path d="M259 153h26v34h-26Z" fill="#63ccc4"/><ellipse cx="272" cy="154" rx="13" ry="4" fill="#c9f5db"/>
      <path d="M298 141h30v46h-30Z" fill="#eaa381"/><path d="M336 154h22v33h-22Z" fill="#b792e2"/><ellipse cx="347" cy="154" rx="11" ry="4" fill="#e3cefb"/>
      <path d="M98 214h27v53H98Z" fill="#b992e5"/><path d="M132 229h26v38h-26Z" fill="#eea676"/><ellipse cx="145" cy="229" rx="13" ry="4" fill="#fff0b0"/>
      <path d="m166 230 6-14h26l5 14v37h-37Z" fill="#66cbb8"/><path d="M214 208h27v59h-27Z" fill="#e879b4"/>
      <path d="M249 224h31v43h-31Z" fill="#d5ef7b"/><path d="M290 216h33v51h-33Z" fill="#f5c96a"/><path d="M332 231h30v36h-30Z" fill="#72bace"/>
    </g>
    <path d="M88 189h286v9H88Zm0 80h286v10H88Z" fill="#77b8af"/>
    <path d="M111 149h15m22 14h9m23-19h16m6 90h12m29-75h13m49-10h14m-198 75h11m150 10h19m22-7h19" stroke="#fff6d9" strokeWidth="4"/>
    <g transform="translate(328 209) rotate(-8)">
      <path d="M0 6h19l19 67h80" fill="none" stroke="#e1e6db" strokeWidth="6" strokeLinecap="round"/>
      <path d="m23 21 107 2-12 41H35Z" fill="#243847" stroke="#d5f479" strokeWidth="4"/>
      <path d="M47 26v33m23-33v33m24-33v33m-60-17h84" stroke="#8aaf81" strokeWidth="2"/>
      <path d="m41 18-4-25 22-4 5 30" fill="#f4b264"/><path d="M75 19V-9h23v29" fill="#bc8eea"/>
      <circle cx="44" cy="86" r="8" fill="#111a30" stroke="#e4c1c8" strokeWidth="4"/><circle cx="110" cy="86" r="8" fill="#111a30" stroke="#e4c1c8" strokeWidth="4"/>
    </g>
    <path d="m414 24 7 15 17 2-13 11 4 17-15-9-15 9 4-17-13-11 17-2Z" fill="#ffe668"/>
    <path d="m29 217-8 9 8 9-8 9m424-76 10 9-10 9 10 9" fill="none" stroke="#a787df" strokeWidth="5" strokeLinecap="round"/>
    <circle cx="52" cy="176" r="4" fill="#6cd3c5"/><circle cx="481" cy="255" r="5" fill="#ec83c9"/>
  </svg>;
}
