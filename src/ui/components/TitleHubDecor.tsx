/**
 * @file Full-bleed beach + procedural layers used behind the title hub and
 * other menu screens that should match its look.
 */

import paradiseBgUrl from '@/assets/ui/title-hub-paradise-bg.png?url';

import '@/ui/screens/titleHub.css';

export function TitleHubDecor() {
  return (
    <div className="th-decor" aria-hidden>
      <div className="th-photoBg" style={{ backgroundImage: `url(${paradiseBgUrl})` }} />
      <div className="th-sky" />
      <div className="th-godRays" />
      <div className="th-sunBloom" />
      <div className="th-sun" />
      <div className="th-cloudLayer">
        <div className="th-cloudBlob th-cloudBlob--a" />
        <div className="th-cloudBlob th-cloudBlob--b" />
        <div className="th-cloudBlob th-cloudBlob--c" />
      </div>
      <div className="th-horizonHaze" />
      <div className="th-seaDeep" />
      <div className="th-seaShallow" />
      <div className="th-waveArc th-waveArc--1" />
      <div className="th-waveArc th-waveArc--2" />
      <div className="th-caustic" />
      <div className="th-foam" />
      <div className="th-sand" />
      <div className="th-sandGrain" />
      <div className="th-island" />
      <div className="th-birds">
        <div className="th-bird th-bird--0" />
        <div className="th-bird th-bird--1" />
        <div className="th-bird th-bird--2" />
        <div className="th-bird th-bird--3" />
        <div className="th-bird th-bird--4" />
      </div>
      <div className="th-sparkles">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="th-spark" />
        ))}
      </div>
      <div className="th-vignette" />
      <div className="th-ambient" />
    </div>
  );
}
