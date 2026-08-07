import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import recordsJson from '../data/results.json';
import worldData from '../data/world';
import {
  EVENTS,
  findSlowerRecords,
  formatTime,
  getTimeFieldsForRecords,
  isEventName,
  isGender,
  timePartsToMilliseconds,
  type EventName,
  type NationalRecord,
  type RecordsData,
  type TimePart,
  type TimePartDefinition,
} from '../domain/records';

interface AppElements {
  form: HTMLFormElement;
  eventSelect: HTMLSelectElement;
  genderSelect: HTMLSelectElement;
  timeEntry: HTMLFieldSetElement;
  timeFields: HTMLElement;
  timePreview: HTMLElement;
  formError: HTMLElement;
  compareButton: HTMLButtonElement;
  results: HTMLElement;
  resultsTitle: HTMLElement;
  resultsDetail: HTMLElement;
  editTimeButton: HTMLButtonElement;
  returnTopButton: HTMLButtonElement;
  worldMap: SVGSVGElement;
  countryList: HTMLOListElement;
  dataStamp: HTMLElement;
  sourceCount: HTMLElement;
}

const records = recordsJson as unknown as RecordsData;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAP_NAME_ALIASES: Record<string, string> = {
  'Antigua and Barbuda': 'Antigua and Barb.',
  'Central African Republic': 'Central African Rep.',
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'Dominican Republic': 'Dominican Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  'Guinea Bissau': 'Guinea-Bissau',
  'Republic of Serbia': 'Serbia',
  'Republic of the Congo': 'Congo',
  'South Sudan': 'S. Sudan',
  'The Bahamas': 'Bahamas',
};

export class HowFastApp {
  private readonly elements: AppElements;
  private readonly mapPaths = new Map<string, SVGPathElement>();

  constructor(private readonly document: Document = globalThis.document) {
    this.elements = this.getElements();
  }

  mount(): void {
    this.populateEvents();
    this.renderMap();
    this.renderDataStamp();

    this.elements.eventSelect.addEventListener('change', () => this.handleEventChange());
    this.elements.genderSelect.addEventListener('change', () => this.handleGenderChange());
    this.elements.timeFields.addEventListener('input', () => this.updateFormState());
    this.elements.form.addEventListener('submit', (event) => this.compare(event));
    this.elements.editTimeButton.addEventListener('click', () => this.editTime());
    this.elements.returnTopButton.addEventListener('click', () => this.returnToTop());
    this.document.defaultView?.addEventListener('scroll', () => this.updateReturnTopButton(), {
      passive: true,
    });

    const restoreSelectionState = (): void => {
      this.document.defaultView?.requestAnimationFrame(() => this.restoreSelectionState());
    };
    this.document.defaultView?.addEventListener('pageshow', restoreSelectionState);
    restoreSelectionState();
  }

  private populateEvents(): void {
    for (const event of EVENTS) {
      const option = this.document.createElement('option');
      option.value = event;
      option.textContent = event;
      this.elements.eventSelect.append(option);
    }
  }

  private handleEventChange(focusTimeWheel = true): void {
    this.elements.formError.textContent = '';
    this.renderTimePicker(focusTimeWheel);
  }

  private handleGenderChange(): void {
    this.elements.formError.textContent = '';
    this.renderTimePicker(true);
  }

  private renderTimePicker(focusTimeWheel: boolean): void {
    const event = this.elements.eventSelect.value;
    const gender = this.elements.genderSelect.value;
    this.elements.timeFields.replaceChildren();
    delete this.elements.timeFields.dataset.selection;

    if (!isEventName(event)) {
      this.elements.timeEntry.disabled = true;
      this.elements.timePreview.textContent = 'Choose an event first.';
      this.updateFormState();
      return;
    }

    if (!isGender(gender)) {
      this.elements.timeEntry.disabled = true;
      this.elements.timePreview.textContent = 'Choose a category.';
      this.updateFormState();
      return;
    }

    this.elements.timeFields.dataset.selection = `${event}:${gender}`;
    for (const field of getTimeFieldsForRecords(event, records.events[event][gender])) {
      this.elements.timeFields.append(this.createTimeWheel(field));
    }

    this.elements.timeEntry.disabled = false;
    this.updateFormState();
    if (focusTimeWheel) this.focusFirstTimeWheel();
  }

  private focusFirstTimeWheel(): void {
    this.elements.timeFields.querySelector<HTMLElement>('.time-wheel')?.focus();
  }

  private restoreSelectionState(): void {
    const event = this.elements.eventSelect.value;
    const gender = this.elements.genderSelect.value;

    if (!isEventName(event) || !isGender(gender)) {
      this.elements.timeEntry.disabled = true;
      this.updateFormState();
      return;
    }

    if (this.elements.timeFields.dataset.selection !== `${event}:${gender}`) {
      this.renderTimePicker(false);
      return;
    }

    this.elements.timeEntry.disabled = false;
    this.updateFormState();
  }

  private createTimeWheel(field: TimePartDefinition): HTMLElement {
    const fieldElement = this.document.createElement('div');
    const wheel = this.document.createElement('div');
    const hiddenInput = this.document.createElement('input');
    const leadingSpacer = this.document.createElement('div');
    const trailingSpacer = this.document.createElement('div');
    const label = this.document.createElement('span');
    const options: HTMLElement[] = [];
    let animationFrame = 0;
    let preserveSelectedValue = false;

    fieldElement.className = 'time-field';
    wheel.className = 'time-wheel';
    wheel.tabIndex = 0;
    wheel.dataset.wheel = field.name;
    wheel.setAttribute('role', 'spinbutton');
    wheel.setAttribute('aria-label', field.label);
    wheel.setAttribute('aria-valuemin', '0');
    wheel.setAttribute('aria-valuemax', field.max.toString());

    hiddenInput.type = 'hidden';
    hiddenInput.name = field.name;
    hiddenInput.value = '0';
    hiddenInput.dataset.timePart = field.name;

    leadingSpacer.className = 'time-wheel-spacer';
    trailingSpacer.className = 'time-wheel-spacer';
    wheel.append(leadingSpacer);

    for (let value = 0; value <= field.max; value += 1) {
      const option = this.document.createElement('div');
      const optionContent = this.document.createElement('span');
      option.className = 'time-wheel-option';
      optionContent.className = 'time-wheel-option-content';
      option.dataset.value = value.toString();
      optionContent.textContent = value.toString().padStart(2, '0');
      option.setAttribute('aria-hidden', 'true');
      option.addEventListener('click', () => selectValue(value, 'smooth'));
      option.append(optionContent);
      options.push(option);
      wheel.append(option);
    }

    wheel.append(trailingSpacer);
    label.className = 'time-field-label';
    label.textContent = field.label;
    fieldElement.append(wheel, hiddenInput, label);

    const updateValue = (value: number): void => {
      const nextValue = Math.max(0, Math.min(field.max, value));
      const changed = hiddenInput.value !== nextValue.toString();
      hiddenInput.value = nextValue.toString();
      wheel.setAttribute('aria-valuenow', nextValue.toString());
      wheel.setAttribute('aria-valuetext', `${nextValue} ${field.label.toLowerCase()}`);
      if (changed) hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const updatePerspective = (): void => {
      animationFrame = 0;
      const rowHeight = options[0]?.offsetHeight || 48;
      const position = wheel.scrollTop / rowHeight;
      const visibleValue = Math.max(0, Math.min(field.max, Math.round(position)));

      for (const [index, option] of options.entries()) {
        const offset = index - position;
        const distance = Math.abs(offset);
        option.style.setProperty('--wheel-angle', `${offset * -24}deg`);
        option.style.setProperty('--wheel-depth', `${distance * -7}px`);
        option.style.setProperty('--wheel-scale', Math.max(0.72, 1 - distance * 0.055).toString());
        option.style.setProperty('--wheel-opacity', Math.max(0, 1 - distance * 0.2).toString());
        option.classList.toggle('time-wheel-option-selected', index === visibleValue);
      }

      if (!preserveSelectedValue) updateValue(visibleValue);
    };

    const selectValue = (value: number, behavior: ScrollBehavior): void => {
      const nextValue = Math.max(0, Math.min(field.max, value));
      const rowHeight = options[0]?.offsetHeight || 48;
      const resolvedBehavior = this.getScrollBehavior(behavior);
      preserveSelectedValue = true;
      updateValue(nextValue);

      if (resolvedBehavior === 'auto') {
        wheel.style.scrollSnapType = 'none';
        wheel.scrollTop = nextValue * rowHeight;
        updatePerspective();
        return;
      }

      wheel.style.removeProperty('scroll-snap-type');
      wheel.scrollTo({ top: nextValue * rowHeight, behavior: resolvedBehavior });
    };

    const beginDirectManipulation = (): void => {
      preserveSelectedValue = false;
      wheel.style.removeProperty('scroll-snap-type');
    };

    wheel.addEventListener('scroll', () => {
      if (animationFrame !== 0) return;
      animationFrame = requestAnimationFrame(updatePerspective);
    });
    wheel.addEventListener('pointerdown', beginDirectManipulation);
    wheel.addEventListener('wheel', beginDirectManipulation, { passive: true });

    wheel.addEventListener('keydown', (event) => {
      const currentValue = Number(hiddenInput.value);
      let nextValue: number | undefined;

      switch (event.key) {
        case 'ArrowUp':
          nextValue = currentValue - 1;
          break;
        case 'ArrowDown':
          nextValue = currentValue + 1;
          break;
        case 'PageUp':
          nextValue = currentValue - 5;
          break;
        case 'PageDown':
          nextValue = currentValue + 5;
          break;
        case 'Home':
          nextValue = 0;
          break;
        case 'End':
          nextValue = field.max;
          break;
      }

      if (nextValue === undefined) return;
      event.preventDefault();
      selectValue(nextValue, 'auto');
    });

    updateValue(0);
    updatePerspective();
    return fieldElement;
  }

  private updateFormState(): void {
    const event = this.elements.eventSelect.value;
    const gender = this.elements.genderSelect.value;
    let validTime = false;

    if (isEventName(event) && isGender(gender) && !this.elements.timeEntry.disabled) {
      try {
        const milliseconds = timePartsToMilliseconds(event, this.readTimeParts());
        this.elements.timePreview.textContent = `Entered time: ${formatTime(milliseconds)}`;
        validTime = true;
      } catch {
        this.elements.timePreview.textContent = 'Enter a time greater than zero.';
      }
    }

    this.elements.compareButton.disabled = !(isEventName(event) && isGender(gender) && validTime);
  }

  private compare(submitEvent: SubmitEvent): void {
    submitEvent.preventDefault();
    this.elements.formError.textContent = '';

    const event = this.elements.eventSelect.value;
    const gender = this.elements.genderSelect.value;
    if (!isEventName(event) || !isGender(gender)) {
      this.elements.formError.textContent = 'Choose an event and category.';
      return;
    }

    let userTime: number;
    try {
      userTime = timePartsToMilliseconds(event, this.readTimeParts());
    } catch (error) {
      this.elements.formError.textContent =
        error instanceof Error ? error.message : 'Enter a valid time.';
      return;
    }

    const slowerRecords = findSlowerRecords(records.events[event][gender], userTime);
    this.showResults(event, gender, userTime, slowerRecords);
  }

  private showResults(
    event: EventName,
    gender: 'women' | 'men',
    userTime: number,
    slowerRecords: NationalRecord[],
  ): void {
    const count = slowerRecords.length;
    this.elements.resultsTitle.textContent =
      count === 0
        ? 'That time does not beat a national record yet.'
        : `You’re faster than ${count} ${count === 1 ? 'country' : 'countries'}.`;
    const categoryLabel = gender === 'women' ? "women's" : "men's";
    this.elements.resultsDetail.textContent = `${formatTime(userTime)} for the ${categoryLabel} ${event}.`;
    this.renderCountryList(slowerRecords);
    this.highlightCountries(slowerRecords);
    this.elements.results.hidden = false;
    this.document.body.classList.add('showing-results');
    this.elements.resultsTitle.focus({ preventScroll: true });
    this.document.defaultView?.scrollTo({ top: 0, behavior: this.getScrollBehavior('smooth') });
    this.updateReturnTopButton();
  }

  private renderCountryList(slowerRecords: NationalRecord[]): void {
    this.elements.countryList.replaceChildren();

    if (slowerRecords.length === 0) {
      const empty = this.document.createElement('li');
      empty.className = 'country-empty';
      empty.textContent = 'Keep training, then come back and try the comparison again.';
      this.elements.countryList.append(empty);
      return;
    }

    slowerRecords.forEach((record) => {
      const item = this.document.createElement('li');
      const source = this.document.createElement('a');
      const time = this.document.createElement('strong');

      source.href = record.sourceUrl;
      source.rel = 'external';
      source.textContent = record.country;
      source.setAttribute('aria-label', `${record.country} record source on Wikipedia`);
      time.textContent = formatTime(record.milliseconds);

      item.append(source, time);
      this.elements.countryList.append(item);
    });
  }

  private renderMap(): void {
    const projection = geoMercator().scale(145).translate([500, 310]);
    const pathGenerator = geoPath(projection);

    for (const feature of worldData.features) {
      const pathData = pathGenerator(feature as GeoPermissibleObjects);
      if (!pathData) continue;

      const path = this.document.createElementNS(SVG_NAMESPACE, 'path');
      const title = this.document.createElementNS(SVG_NAMESPACE, 'title');
      const countryName = feature.properties.name;
      path.setAttribute('d', pathData);
      path.setAttribute('class', 'map-country');
      path.dataset.country = countryName;
      title.textContent = countryName;
      path.append(title);
      this.elements.worldMap.append(path);
      this.mapPaths.set(countryName, path);
    }
  }

  private highlightCountries(slowerRecords: NationalRecord[]): void {
    for (const path of this.mapPaths.values()) path.classList.remove('map-country-faster');

    for (const record of slowerRecords) {
      const mapName = MAP_NAME_ALIASES[record.country] ?? record.country;
      this.mapPaths.get(mapName)?.classList.add('map-country-faster');
    }
  }

  private editTime(): void {
    const view = this.document.defaultView;
    const documentElement = this.document.documentElement;
    const previousScrollBehavior = documentElement.style.scrollBehavior;

    this.elements.results.hidden = true;
    this.restoreSelectionState();
    this.document.body.classList.remove('showing-results');

    documentElement.style.scrollBehavior = 'auto';
    this.document.body.getBoundingClientRect();
    documentElement.scrollTop = 0;
    this.document.body.scrollTop = 0;
    view?.scrollTo(0, 0);
    documentElement.style.scrollBehavior = previousScrollBehavior;

    this.updateReturnTopButton();
    this.elements.eventSelect.focus({ preventScroll: true });
  }

  private returnToTop(): void {
    this.elements.resultsTitle.focus({ preventScroll: true });
    this.document.defaultView?.scrollTo({ top: 0, behavior: this.getScrollBehavior('smooth') });
  }

  private getScrollBehavior(behavior: ScrollBehavior): ScrollBehavior {
    const reducedMotion = this.document.defaultView?.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    return behavior === 'smooth' && reducedMotion ? 'auto' : behavior;
  }

  private updateReturnTopButton(): void {
    const view = this.document.defaultView;
    const visibilityThreshold = view ? Math.max(160, view.innerHeight * 0.25) : 160;
    const visible =
      view !== null &&
      this.document.body.classList.contains('showing-results') &&
      view.scrollY > visibilityThreshold;

    this.elements.returnTopButton.classList.toggle('result-top-button-visible', visible);
    this.elements.returnTopButton.disabled = !visible;
  }

  private renderDataStamp(): void {
    const date = new Date(records.generatedAt);
    const formattedDate = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    this.elements.sourceCount.textContent = records.sourcePageCount.toString();
    this.elements.dataStamp.textContent = `${records.sourcePageCount} source pages · Records refreshed ${formattedDate}`;
  }

  private readTimeParts(): Partial<Record<TimePart, number>> {
    const values: Partial<Record<TimePart, number>> = {};
    this.elements.timeFields
      .querySelectorAll<HTMLInputElement>('[data-time-part]')
      .forEach((input) => {
        const part = input.dataset.timePart as TimePart;
        values[part] = Number(input.value);
      });
    return values;
  }

  private getElements(): AppElements {
    return {
      form: this.requireElement<HTMLFormElement>('comparison-form'),
      eventSelect: this.requireElement<HTMLSelectElement>('event-select'),
      genderSelect: this.requireElement<HTMLSelectElement>('gender-select'),
      timeEntry: this.requireElement<HTMLFieldSetElement>('time-entry'),
      timeFields: this.requireElement('time-fields'),
      timePreview: this.requireElement('time-preview'),
      formError: this.requireElement('form-error'),
      compareButton: this.requireElement<HTMLButtonElement>('compare-button'),
      results: this.requireElement('results'),
      resultsTitle: this.requireElement('results-title'),
      resultsDetail: this.requireElement('results-detail'),
      editTimeButton: this.requireElement<HTMLButtonElement>('edit-time'),
      returnTopButton: this.requireElement<HTMLButtonElement>('return-top'),
      worldMap: this.requireElement<SVGSVGElement>('world-map'),
      countryList: this.requireElement<HTMLOListElement>('country-list'),
      dataStamp: this.requireElement('data-stamp'),
      sourceCount: this.requireElement('source-count'),
    };
  }

  private requireElement<T extends Element = HTMLElement>(id: string): T {
    const element = this.document.getElementById(id);
    if (!element) throw new Error(`Missing required element #${id}.`);
    return element as unknown as T;
  }
}
