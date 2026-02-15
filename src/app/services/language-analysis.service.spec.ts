import { TestBed } from '@angular/core/testing';

import { LanguageAnalysisService } from './language-analysis.service';

describe('LanguageAnalysisService', () => {
  let service: LanguageAnalysisService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageAnalysisService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
