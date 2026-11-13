"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

// Cloudflare captcha (widget "amplior.com", hostnames include altleads.com). The site key is public.
const SITE_KEY = "0x4AAAAAAFsnZp2q4v3gaJkl";

// Renders inside a <form>; Cloudflare adds a hidden "cf-turnstile-response" field to it.
export default function Turnstile() {
    const ref = useRef(null);
    useEffect(() => {
        let id;
        const draw = () => {
            if (id === undefined && window.turnstile && ref.current) id = window.turnstile.render(ref.current, { sitekey: SITE_KEY });
            return id !== undefined;
        };
        const timer = setInterval(() => draw() && clearInterval(timer), 300);
        return () => {
            clearInterval(timer);
            if (id !== undefined) window.turnstile?.remove(id);
        };
    }, []);
    return (
        <>
            <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
            <div ref={ref} className="my-4" />
        </>
    );
}
