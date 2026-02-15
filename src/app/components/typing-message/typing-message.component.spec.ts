import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TypingMessageComponent } from './typing-message.component';

describe('TypingMessageComponent', () => {
  let component: TypingMessageComponent;
  let fixture: ComponentFixture<TypingMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TypingMessageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TypingMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
