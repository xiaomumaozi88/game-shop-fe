import { RefObject, useLayoutEffect } from 'react';

interface UseFitTextOptions {
  minFontSize?: number;
  maxFontSize?: number;
  step?: number;
  allowWrapAtMin?: boolean;
  wrapClassName?: string;
}

function fitElementsToWidth(
  elements: HTMLElement[],
  options: UseFitTextOptions
) {
  const {
    minFontSize = 10,
    maxFontSize,
    step = 0.5,
    allowWrapAtMin = false,
    wrapClassName,
  } = options;

  elements.forEach((el) => {
    el.style.fontSize = '';
    if (wrapClassName) {
      el.classList.remove(wrapClassName);
    }
  });

  const computedMax =
    maxFontSize ??
    Math.min(...elements.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  let size = Math.max(computedMax, minFontSize);

  const applySize = (nextSize: number) => {
    const clampedSize = Math.max(nextSize, minFontSize);
    elements.forEach((el) => {
      el.style.fontSize = `${clampedSize}px`;
    });
  };

  applySize(size);

  while (size > minFontSize) {
    const allFit = elements.every((el) => {
      const container = el.parentElement;
      if (!container) return true;
      return el.scrollWidth <= container.clientWidth;
    });
    if (allFit) break;
    size = Math.max(size - step, minFontSize);
    applySize(size);
  }

  if (allowWrapAtMin && wrapClassName) {
    elements.forEach((el) => {
      const container = el.parentElement;
      if (container && el.scrollWidth > container.clientWidth) {
        el.classList.add(wrapClassName);
      }
    });
  }
}

export function useFitText(
  ref: RefObject<HTMLElement | null>,
  text: string,
  options: UseFitTextOptions = {}
) {
  const { minFontSize = 10, maxFontSize, step = 0.5, allowWrapAtMin, wrapClassName } = options;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frameId: number | null = null;

    const fit = () => {
      fitElementsToWidth([el], {
        minFontSize,
        maxFontSize,
        step,
        allowWrapAtMin,
        wrapClassName,
      });
    };

    const scheduleFit = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        fit();
      });
    };

    fit();

    const observer = new ResizeObserver(scheduleFit);
    const container = el.parentElement;
    if (container) {
      observer.observe(container);
    }

    document.fonts?.ready.then(scheduleFit).catch(() => {});

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
      el.style.fontSize = '';
      if (wrapClassName) {
        el.classList.remove(wrapClassName);
      }
    };
  }, [text, minFontSize, maxFontSize, step, allowWrapAtMin, wrapClassName]);
}

export function useFitTextGroup(
  refs: RefObject<HTMLElement | null>[],
  texts: readonly string[],
  options: UseFitTextOptions = {}
) {
  const { minFontSize = 10, maxFontSize, step = 0.5, allowWrapAtMin, wrapClassName } = options;
  const textKey = texts.join('\u0000');

  useLayoutEffect(() => {
    const elements = refs
      .map((ref) => ref.current)
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length !== refs.length) return;

    let frameId: number | null = null;

    const fit = () => {
      fitElementsToWidth(elements, {
        minFontSize,
        maxFontSize,
        step,
        allowWrapAtMin,
        wrapClassName,
      });
    };

    const scheduleFit = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        fit();
      });
    };

    fit();

    const observer = new ResizeObserver(scheduleFit);
    const observed = new Set<Element>();
    elements.forEach((el) => {
      const container = el.parentElement;
      if (container && !observed.has(container)) {
        observer.observe(container);
        observed.add(container);
      }
    });

    document.fonts?.ready.then(scheduleFit).catch(() => {});

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
      elements.forEach((el) => {
        el.style.fontSize = '';
        if (wrapClassName) {
          el.classList.remove(wrapClassName);
        }
      });
    };
  }, [textKey, minFontSize, maxFontSize, step, allowWrapAtMin, wrapClassName]);
}
