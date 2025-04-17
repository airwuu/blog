"use client";

import { useEffect, useState, useRef, memo } from "react";
import { motion, useInView } from "framer-motion";

type AnimatedTextProps = {
  text: string;
  className?: string;
  once?: boolean;
  delay?: number;
  type?: "words" | "characters";
  animationVariant?: "slide" | "fade" | "scale" | "bounce";
};

// Memoized version for better performance
export const AnimatedText = memo(function AnimatedText({
  text,
  className = "",
  once = true,
  delay = 0,
  type = "words",
  animationVariant = "slide",
}: AnimatedTextProps) {
  const [splitText, setSplitText] = useState<string[]>([]);
  const ref = useRef(null);
  const isInView = useInView(ref, { once, amount: 0.2 });

  useEffect(() => {
    if (type === "words") {
      setSplitText(text.split(" "));
    } else {
      setSplitText(text.split(""));
    }
  }, [text, type]);

  // Animation variants based on type
  const getAnimationVariants = () => {
    switch (animationVariant) {
      case "fade":
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };
      case "scale":
        return {
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1 },
        };
      case "bounce":
        return {
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 12 } },
        };
      case "slide":
      default:
        return {
          hidden: { opacity: 0, y: 15 }, // Reduced y offset for performance
          visible: { opacity: 1, y: 0 },
        };
    }
  };

  const container = {
    hidden: { opacity: 0 },
    visible: (i: number = 1) => ({
      opacity: 1,
      transition: {
        staggerChildren: 0.04, // Faster stagger for better performance
        delayChildren: delay || 0,
      },
    }),
  };

  const child = getAnimationVariants();

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={container}
      className={className}
      custom={1}
    >
      {splitText.map((item, index) => (
        <motion.span
          key={index}
          variants={child}
          className={type === "words" ? "inline-block mr-[0.25em]" : "inline-block"}
          style={{
            ...(type === "characters" && item === " " ? { marginRight: "0.25em" } : {}),
          }}
        >
          {item}
          {type === "words" && index !== splitText.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </motion.div>
  );
});

// Animated heading with 2.5D effect - optimized for performance
export const AnimatedHeading = memo(function AnimatedHeading({
  text,
  className = "",
  tag = "h2",
  delay = 0,
}: {
  text: string;
  className?: string;
  tag?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  // Reduced number of shadows for better performance
  const shadows = Array.from({ length: 3 }, (_, i) => i + 1);
  const baseClass = `font-bold ${className}`;

  const variants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay,
        ease: "easeOut",
      },
    },
  };

  const shadowVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: delay + 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 0.05 },
  };

  const Heading = ({ children }: { children: React.ReactNode }) => {
    switch (tag) {
      case "h1":
        return <h1 className={baseClass}>{children}</h1>;
      case "h3":
        return <h3 className={baseClass}>{children}</h3>;
      case "h4":
        return <h4 className={baseClass}>{children}</h4>;
      case "h5":
        return <h5 className={baseClass}>{children}</h5>;
      case "h6":
        return <h6 className={baseClass}>{children}</h6>;
      case "h2":
      default:
        return <h2 className={baseClass}>{children}</h2>;
    }
  };

  return (
    <div ref={ref} className="relative inline-block">
      <motion.div
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={shadowVariants}
        className="absolute inset-0 pointer-events-none"
      >
        {shadows.map((depth) => (
          <motion.div
            key={depth}
            variants={itemVariants}
            className="absolute inset-0"
            style={{
              transform: `translate(${depth * 2}px, ${depth * 2}px)`,
              zIndex: -depth,
            }}
          >
            <Heading>{text}</Heading>
          </motion.div>
        ))}
      </motion.div>
      <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={variants}>
        <Heading>{text}</Heading>
      </motion.div>
    </div>
  );
});
