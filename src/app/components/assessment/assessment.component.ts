import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Skill, Level, UserLevel } from '../../shared/interfaces/english-learning.interfaces';

@Component({
  selector: 'app-assessment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assessment.component.html',
  styleUrls: ['./assessment.component.scss']
})
export class AssessmentComponent {
  @Output() assessmentComplete = new EventEmitter<UserLevel>();

  userLevel: UserLevel = { speaking: 0, writing: 0, grammar: 0, vocabulary: 0 };

  skillsToAssess: Skill[] = [
    { key: 'speaking', nameEn: 'Speaking', nameHe: 'דיבור' },
    { key: 'writing', nameEn: 'Writing', nameHe: 'כתיבה' },
    { key: 'grammar', nameEn: 'Grammar', nameHe: 'דקדוק' },
    { key: 'vocabulary', nameEn: 'Vocabulary', nameHe: 'אוצר מילים' }
  ];

  levels: Level[] = [
    { value: 1, nameEn: 'Beginner', nameHe: 'מתחיל' },
    { value: 2, nameEn: 'Elementary', nameHe: 'בסיסי' },
    { value: 3, nameEn: 'Intermediate', nameHe: 'בינוני' },
    { value: 4, nameEn: 'Advanced', nameHe: 'מתקדם' }
  ];

  skillColors: Record<string, string> = {
    speaking: '#7B8CDE',
    writing: '#70C1B3',
    grammar: '#FFB997',
    vocabulary: '#B6A4CE'
  };

  levelColors: Record<number, string> = {
    1: '#70C1B3',
    2: '#7B8CDE',
    3: '#FFB997',
    4: '#E8787A'
  };

  selectLevel(skill: Skill, level: number): void {
    skill.selectedLevel = level;
    this.userLevel[skill.key] = level;
  }

  areAllSkillsAssessed(): boolean {
    return this.skillsToAssess.every(skill => skill.selectedLevel !== undefined);
  }

  onComplete(): void {
    if (this.areAllSkillsAssessed()) {
      this.assessmentComplete.emit({ ...this.userLevel });
    }
  }

  getSelectedCount(): number {
    return this.skillsToAssess.filter(s => s.selectedLevel !== undefined).length;
  }

  getRadarPoints(): string {
    const cx = 90, cy = 90, maxR = 70;
    const skills = this.skillsToAssess;
    const points: string[] = [];

    for (let i = 0; i < skills.length; i++) {
      const angle = (Math.PI * 2 * i) / skills.length - Math.PI / 2;
      const val = (skills[i].selectedLevel || 0) / 4;
      const r = val * maxR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      points.push(`${x},${y}`);
    }

    return points.join(' ');
  }

  getRadarAxisEnd(index: number): { x: number; y: number } {
    const cx = 90, cy = 90, maxR = 70;
    const angle = (Math.PI * 2 * index) / this.skillsToAssess.length - Math.PI / 2;
    return {
      x: cx + maxR * Math.cos(angle),
      y: cy + maxR * Math.sin(angle)
    };
  }

  getRadarLabelPos(index: number): { x: number; y: number } {
    const cx = 90, cy = 90, r = 85;
    const angle = (Math.PI * 2 * index) / this.skillsToAssess.length - Math.PI / 2;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    };
  }

  getRadarRingPoints(ringLevel: number): string {
    const cx = 90, cy = 90, maxR = 70;
    const r = (ringLevel / 4) * maxR;
    const points: string[] = [];
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 - Math.PI / 2;
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return points.join(' ');
  }

  trackBySkillKey(_index: number, skill: Skill): string {
    return skill.key;
  }

  trackByLevelValue(_index: number, level: Level): number {
    return level.value;
  }
}
