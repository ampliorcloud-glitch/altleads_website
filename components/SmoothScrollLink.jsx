"use client";

/**
 * A link component that scrolls smoothly to a target element
 * without adding a hash fragment to the URL.
 */
export default function SmoothScrollLink({ href, children, className, onClick, ...props }) {
    const handleClick = (e) => {
        // Only handle same-page hash links
        if (href && href.startsWith("#")) {
            e.preventDefault();
            const targetId = href.slice(1);

            if (targetId === "" || targetId === "top") {
                // Scroll to top
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                const el = document.getElementById(targetId);
                if (el) {
                    el.scrollIntoView({ behavior: "smooth" });
                }
            }

            // Clean the URL — remove any hash
            if (window.location.hash) {
                history.replaceState(null, "", window.location.pathname + window.location.search);
            }

            if (onClick) onClick(e);
        }
    };

    return (
        <a href={href} onClick={handleClick} className={className} {...props}>
            {children}
        </a>
    );
}
