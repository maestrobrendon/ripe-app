"use client";

import { useState } from "react";
import { SmoothScroll } from "../home-next/parts/runtime";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Hero } from "./parts/hero";
import { Menu } from "./parts/menu";
import { How } from "./parts/how";
import { Inside } from "./parts/inside";
import { Details } from "./parts/details";
import { Price } from "./parts/price";
import { Faq, Closing } from "./parts/closing";
import type { MenuGoal } from "./recipes";
import type { MenuData } from "./types";

/**
 * Seven sections, each one making people hungry, building trust, or
 * answering "how much": the promise, the menu, how it works (with Kachi),
 * what's inside a recipe, the small things, the price, the questions.
 *
 * One goal runs through the page. Pick it in the hero and the menu, Kachi's
 * demo and the price all follow.
 */
export function HomeMenu({ data }: { data: MenuData }) {
  const [goal, setGoal] = useState<MenuGoal>("lighter");

  return (
    <SmoothScroll>
      <div className="hm">
        <MarketingNav variant="home" signedIn={data.signedIn} />
        <main>
          <Hero signedIn={data.signedIn} onPickGoal={setGoal} zones={data.zones} />
          <Menu goal={goal} onGoal={setGoal} products={data.products} signedIn={data.signedIn} />
          <How goal={goal} deliveryDay={data.deliveryDay} products={data.products} signedIn={data.signedIn} />
          <Inside products={data.products} />
          <Details deliveryDay={data.deliveryDay} />
          <Price
            goal={goal}
            onGoal={setGoal}
            candidates={data.estimatorCandidates}
            memberFee={data.memberFee}
            signedIn={data.signedIn}
          />
          <Faq
            zones={data.zones}
            comingSoon={data.comingSoon}
            memberFee={data.memberFee}
          />
          <Closing signedIn={data.signedIn} />
        </main>
        <MarketingFooter />
      </div>
    </SmoothScroll>
  );
}
