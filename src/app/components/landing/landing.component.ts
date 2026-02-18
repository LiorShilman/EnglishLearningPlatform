import { Component, Output, EventEmitter, AfterViewInit, OnDestroy, NgZone, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DemoMessage {
  sender: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  @Output() landingComplete = new EventEmitter<void>();

  // Demo typewriter
  demoMessages: DemoMessage[] = [];
  showThinkingDots = false;
  showLearningBlock = false;
  showVocabCard = false;
  private demoTimeout: ReturnType<typeof setTimeout> | null = null;
  private demoRunning = false;

  // Scroll-triggered visibility
  featuresVisible = false;
  stepsVisible = false;
  statsVisible = false;
  quoteVisible = false;

  // Stats counters
  statCounters = [0, 0, 0, 0];
  private readonly statTargets = [4, 24, 2, 100];
  private counterAnimated = false;

  private observers: IntersectionObserver[] = [];

  // Word chips for hero
  wordChips = [
    { en: 'grammar', he: 'דקדוק', color: 'teal', x: 8, y: 15, duration: 6, delay: 0 },
    { en: 'fluent', he: 'שוטף', color: 'periwinkle', x: 75, y: 22, duration: 7, delay: 1 },
    { en: 'vocabulary', he: 'מילים', color: 'lavender', x: 20, y: 70, duration: 8, delay: 2 },
    { en: 'practice', he: 'תרגול', color: 'coral', x: 82, y: 65, duration: 6.5, delay: 0.5 },
    { en: 'speak', he: 'לדבר', color: 'teal', x: 50, y: 85, duration: 7.5, delay: 1.5 },
    { en: 'learn', he: 'ללמוד', color: 'periwinkle', x: 12, y: 45, duration: 6.8, delay: 2.5 },
    { en: 'write', he: 'לכתוב', color: 'coral', x: 88, y: 42, duration: 7.2, delay: 0.8 },
  ];

  constructor(private ngZone: NgZone, private elRef: ElementRef) {}

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.initScrollObservers();
        this.startDemoSequence();
      }, 600);
    });
  }

  onStartJourney(): void {
    this.landingComplete.emit();
  }

  private initScrollObservers(): void {
    const createObserver = (selector: string, callback: () => void) => {
      const el = this.elRef.nativeElement.querySelector(selector);
      if (!el) return;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.ngZone.run(callback);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      observer.observe(el);
      this.observers.push(observer);
    };

    createObserver('.features-section', () => { this.featuresVisible = true; });
    createObserver('.steps-section', () => { this.stepsVisible = true; });
    createObserver('.stats-section', () => {
      this.statsVisible = true;
      this.animateCounters();
    });
    createObserver('.quote-section', () => { this.quoteVisible = true; });
  }

  private animateCounters(): void {
    if (this.counterAnimated) return;
    this.counterAnimated = true;

    this.statTargets.forEach((target, index) => {
      const duration = 1500;
      const steps = 30;
      const increment = target / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current = Math.min(Math.round(increment * step), target);
        this.ngZone.run(() => { this.statCounters[index] = current; });
        if (step >= steps) clearInterval(timer);
      }, duration / steps);
    });
  }

  private startDemoSequence(): void {
    this.demoRunning = true;
    this.runDemoCycle();
  }

  private async runDemoCycle(): Promise<void> {
    if (!this.demoRunning) return;

    // Reset
    this.ngZone.run(() => {
      this.demoMessages = [];
      this.showThinkingDots = false;
      this.showLearningBlock = false;
      this.showVocabCard = false;
    });

    await this.delay(800);

    // User types
    await this.typeMessage('user', 'I goed to the store yesterday and buyed some food');

    await this.delay(600);

    // Show thinking dots
    this.ngZone.run(() => { this.showThinkingDots = true; });
    await this.delay(1200);
    this.ngZone.run(() => { this.showThinkingDots = false; });

    // AI response
    await this.typeMessage('assistant', 'Great effort! Did you mean: "I **went** to the store yesterday and **bought** some food"?');

    await this.delay(400);

    // Show learning block
    this.ngZone.run(() => { this.showLearningBlock = true; });
    await this.delay(800);

    // Show vocab card
    this.ngZone.run(() => { this.showVocabCard = true; });
    await this.delay(4000);

    // Loop
    if (this.demoRunning) {
      this.runDemoCycle();
    }
  }

  private typeMessage(sender: 'user' | 'assistant', text: string): Promise<void> {
    return new Promise((resolve) => {
      const msg: DemoMessage = { sender, text: '' };
      this.ngZone.run(() => { this.demoMessages.push(msg); });

      let i = 0;
      const interval = setInterval(() => {
        if (i < text.length) {
          msg.text += text[i];
          i++;
          this.ngZone.run(() => {});
        } else {
          clearInterval(interval);
          resolve();
        }
      }, sender === 'user' ? 40 : 20);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.demoTimeout = setTimeout(resolve, ms);
    });
  }

  ngOnDestroy(): void {
    this.demoRunning = false;
    if (this.demoTimeout) clearTimeout(this.demoTimeout);
    this.observers.forEach(o => o.disconnect());
  }
}
