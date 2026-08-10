package com.example.backend.controller;

import com.example.backend.entity.FilteredMessage;
import com.example.backend.repository.FilteredMessageRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FilteredMessageControllerTest {

    @Mock FilteredMessageRepository repository;

    @Test
    void returnsSearchablePageWithRequestedSize() {
        when(repository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(new FilteredMessage())));
        FilteredMessageController controller = new FilteredMessageController(repository);

        var result = controller.getFilteredMessages(2, 10, "card", "BLOCKED", "123e4567-e89b-12d3-a456-426614174000", null, null);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(any(Specification.class), pageable.capture());
        assertThat(result.getContent()).hasSize(1);
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(2);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(10);
    }
}
