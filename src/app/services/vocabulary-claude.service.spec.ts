import { TestBed } from '@angular/core/testing';

import { VocabularyClaudeService } from './vocabulary-claude.service';

describe('VocabularyClaudeService', () => {
  let service: VocabularyClaudeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VocabularyClaudeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
