import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VirtualAvatarComponent } from './virtual-avatar.component';

describe('VirtualAvatarComponent', () => {
  let component: VirtualAvatarComponent;
  let fixture: ComponentFixture<VirtualAvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VirtualAvatarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VirtualAvatarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
