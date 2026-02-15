import { TestBed } from '@angular/core/testing';

import { EnhancedClaudeService } from './enhanced-claude.service';

describe('EnhancedClaudeService', () => {
  let service: EnhancedClaudeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EnhancedClaudeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
