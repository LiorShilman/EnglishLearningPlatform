import { TestBed } from '@angular/core/testing';

import { ConversationTopicsService } from './conversation-topics.service';

describe('ConversationTopicsService', () => {
  let service: ConversationTopicsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConversationTopicsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
