"use client";

import { useState } from "react";
import { SmoothScroll } from "./parts/runtime";
import { Nav } from "./parts/nav";
import { Hero } from "./parts/hero";
import { Week, Statement } from "./parts/week";
import { Journey } from "./parts/journey";
import { How } from "./parts/how";
import { Goals, Farm } from "./parts/goals";
import { People, MarketBand } from "./parts/people";
import { Price } from "./parts/price";
import { Trial, Faq, Footer } from "./parts/closing";
import type { HomeData } from "./types";

/**
 * The story, in order: the promise, a normal week, the turn, where a basket
 * comes from, how it works, what goes in it, who it is for, what it costs,
 * the Saturday you get back, the offer, the questions.
 */
export function HomeNext({ data }: { data: HomeData }) {
  const [goal, setGoal] = useState(data.goals[0]?.slug ?? "");

  // Photographed products first, in season first, so the stickers are real.
  const pictured = [...data.farm].sort(
    (a, b) => Number(Boolean(b.cloudinaryPublicId)) - Number(Boolean(a.cloudinaryPublicId)) || Number(b.inSeason) - Number(a.inSeason),
  );
  const showcase = data.goals[0];
  const goalLabels = Object.fromEntries(data.goals.map((g) => [g.slug, g.tab]));

  return (
    <SmoothScroll>
      <Nav signedIn={data.signedIn} />
      <main>
        <Hero
          stickers={pictured.slice(0, 6)}
          deliveryDay={data.deliveryDay}
          basketLabel={showcase ? `${showcase.title}, ${showcase.picks.length} items` : "Your basket"}
          zones={data.zones.map((z) => z.name)}
          signedIn={data.signedIn}
        />
        <Week />
        <Statement />
        <Journey />
        {showcase && <How goal={showcase} deliveryDay={data.deliveryDay} />}
        <Goals goals={data.goals} active={goal} onChange={setGoal} signedIn={data.signedIn} />
        <Farm products={data.farm} />
        <People goalLabels={goalLabels} onPick={setGoal} />
        <Price
          candidates={data.estimatorCandidates}
          memberFee={data.memberFee}
          freeDeliveryThreshold={data.freeDeliveryThreshold}
          signedIn={data.signedIn}
        />
        <MarketBand />
        <Trial stickers={pictured.slice(6, 10)} signedIn={data.signedIn} />
        <Faq
          zones={data.zones}
          comingSoon={data.comingSoon}
          deliveryFee={data.deliveryFee}
          freeDeliveryThreshold={data.freeDeliveryThreshold}
          memberFee={data.memberFee}
        />
      </main>
      <Footer />
    </SmoothScroll>
  );
}
