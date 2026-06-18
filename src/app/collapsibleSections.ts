const MOBILE_COLLAPSED_SECTION_TITLES = new Set([
  "Launch",
  "Telemetry",
  "Selected Body",
  "Dataset",
]);

export function shouldCollapseSectionByDefault(input: {
  readonly title: string;
  readonly narrowViewport: boolean;
}): boolean {
  return input.narrowViewport && MOBILE_COLLAPSED_SECTION_TITLES.has(input.title);
}

export function setupCollapsibleSections(input: {
  readonly panel: HTMLElement;
  readonly narrowViewport?: boolean;
}): void {
  const narrowViewport =
    input.narrowViewport ?? window.matchMedia("(max-width: 760px)").matches;
  const sections = input.panel.querySelectorAll<HTMLElement>(".control-section");

  sections.forEach((section, index) => {
    const heading = section.querySelector<HTMLElement>(":scope > .section-heading");
    if (!heading || heading.querySelector(".section-toggle")) return;

    const titleElement = heading.querySelector<HTMLElement>("span:first-child");
    const title = titleElement?.textContent?.trim() ?? `Section ${index + 1}`;
    const status = heading.querySelector<HTMLElement>(".status");
    const content = document.createElement("div");
    content.className = "section-content";
    content.id = `section-content-${index}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-toggle";
    button.setAttribute("aria-controls", content.id);
    button.textContent = title;

    for (const child of [...section.childNodes]) {
      if (child === heading) continue;
      content.append(child);
    }

    heading.replaceChildren(button);
    if (status) heading.append(status);
    section.append(content);

    const setCollapsed = (collapsed: boolean): void => {
      section.classList.toggle("collapsed", collapsed);
      content.hidden = collapsed;
      button.setAttribute("aria-expanded", String(!collapsed));
    };

    setCollapsed(shouldCollapseSectionByDefault({ title, narrowViewport }));
    button.addEventListener("click", () => {
      setCollapsed(!section.classList.contains("collapsed"));
    });
  });
}
