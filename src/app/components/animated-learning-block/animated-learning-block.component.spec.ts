import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimatedLearningBlockComponent } from './animated-learning-block.component';

describe('AnimatedLearningBlockComponent', () => {
  let component: AnimatedLearningBlockComponent;
  let fixture: ComponentFixture<AnimatedLearningBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnimatedLearningBlockComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnimatedLearningBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
