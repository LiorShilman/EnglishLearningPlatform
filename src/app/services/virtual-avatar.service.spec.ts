import { TestBed } from '@angular/core/testing';

import { VirtualAvatarService } from './virtual-avatar.service';

describe('VirtualAvatarService', () => {
  let service: VirtualAvatarService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VirtualAvatarService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
