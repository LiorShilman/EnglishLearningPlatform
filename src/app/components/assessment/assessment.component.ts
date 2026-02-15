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

  trackBySkillKey(_index: number, skill: Skill): string {
    return skill.key;
  }

  trackByLevelValue(_index: number, level: Level): number {
    return level.value;
  }
}
