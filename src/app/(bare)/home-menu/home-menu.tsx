"use client";

import { useState } from "react";
import { SmoothScroll } from "../home-next/parts/runtime";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Hero } from "./parts/hero";
import { Menu } from "./parts/menu";
import { How } from "./parts/how";
import { Details } from "./parts/details";
import { Price } from "./parts/price";
import { Areas } from "./parts/areas";
import { Faq, Closing } from "./parts/closing";
import type { MenuGoal } from "./recipes";
import type { MenuData } from "./types";

/**
 * Eight sections, and the page gets denser as it goes: the hero says what
 * Basket is in one sentence, then what arrives (the produce, with the small
 * things beside it), the recipes that make it worth eating, how it works,
 * where we deliver, the price, the questions, and the closing invitation.
 *
 * One goal runs through the page. Pick it in the menu and Kachi's demo and
 * the price follow.
 */
export function HomeMenu({ data }: { data: MenuData }) {
  const [goal, setGoal] = useState<MenuGoal>("lighter");

  return (
    <SmoothScroll>
      <div className="hm">
        <MarketingNav variant="home" signedIn={data.signedIn} />
        <main>
          <Hero signedIn={data.signedIn} />
          <Details deliveryDay={data.deliveryDay} />
          <Menu goal={goal} onGoal={setGoal} products={data.products} signedIn={data.signedIn} />
          <How goal={goal} deliveryDay={data.deliveryDay} products={data.products} signedIn={data.signedIn} />
          <Areas areas={data.areas} days={data.areaDays} comingSoon={data.comingSoon} signedIn={data.signedIn} />
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
