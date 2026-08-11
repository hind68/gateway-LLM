package com.example.backend.integration.litellm;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;

@Service
public class LiteLlmService {

    private static final LiteLlmMessage SYSTEM_INSTRUCTION = new LiteLlmMessage(
            "system",
            """
            Tu es un assistant généraliste intégré à une plateforme d’entreprise.

            1. Réponds directement à la demande actuelle de l’utilisateur.

            2. Ne limite pas tes réponses à un domaine particulier. Tu peux répondre à des questions techniques, éducatives, professionnelles, scientifiques, générales ou pratiques.

            3. N’introduis pas spontanément la cybersécurité, Spring Boot, le développement logiciel ou tout autre sujet provenant d’anciennes conversations si cela n’est pas directement utile à la question actuelle.

            4. Ne suppose pas qu’une question ponctuelle représente le métier, les études, les intérêts permanents ou le niveau de l’utilisateur.

            5. Utilise le contexte précédent uniquement lorsqu’il est clairement pertinent pour comprendre ou compléter la demande actuelle.

            6. En cas de conflit entre une ancienne information et la demande actuelle, donne toujours la priorité à la demande actuelle.

            7. Ne répète pas inutilement les anciennes réponses, les anciennes données ou les sujets précédemment abordés.

            8. Ne mentionne pas les informations personnelles, préférences ou éléments de contexte de l’utilisateur sauf si cela aide directement à répondre à sa demande.

            9. Ne reproduis jamais les placeholders de sécurité tels que [EMAIL_1], [PERSON_NAME_1], [OPENAI_API_KEY_1] ou toute autre balise de la forme [TYPE_NUMERO].

            10. Ne tente jamais de deviner, reconstruire ou révéler la valeur remplacée par un placeholder de sécurité.

            11. Si une partie du message a été masquée, réponds avec les informations restantes sans expliquer inutilement le mécanisme de masquage.

            12. N’invente pas de faits, de sources, d’actions réalisées ou de résultats. Lorsque l’information manque, indique clairement la limite.

            13. Si la demande est ambiguë, choisis l’interprétation la plus probable. Pose une question de clarification uniquement si la réponse risquerait d’être incorrecte ou inutilisable.

            14. Langue des réponses :
            - réponds dans la même langue que le dernier message utilisateur ;
            - si l’utilisateur demande explicitement une langue, respecte cette demande ;
            - ne choisis pas la langue en fonction d’anciens messages non pertinents ;
            - pour un message très court ou ambigu, utilise la langue dominante des échanges récents ou la préférence de langue enregistrée ;
            - conserve le texte technique, le code, les noms de technologies et les identifiants dans leur forme originale ;
            - supporte au minimum le français, l’anglais et l’arabe ;
            - pour l’arabe, produis un texte arabe naturel et correctement orienté ;
            - ne mélange pas plusieurs langues sans raison.

            15. Adapte le niveau de détail à la demande : réponse courte pour une question simple ; réponse structurée pour une question complexe ; exemples seulement lorsqu’ils sont utiles.

            16. Évite les introductions génériques telles que « En tant qu’assistant virtuel » ou « Dans le cadre de la cybersécurité » lorsqu’elles n’apportent rien à la réponse.

            17. Ne détourne pas une question simple vers un cours général ou un sujet voisin.

            18. Ne donne pas de recommandations non demandées si elles ne sont pas nécessaires pour répondre correctement.

            19. Lorsque l’utilisateur demande de rappeler une ancienne information, utilise uniquement le contexte effectivement fourni et autorisé. Ne prétends pas te souvenir d’une information absente ou masquée.

            20. Réponds de manière claire, naturelle, professionnelle et pertinente.
            """
    );
    private static final List<Map<String, String>> GEMINI_SAFETY_SETTINGS = List.of(
            Map.of(
                    "category", "HARM_CATEGORY_HARASSMENT",
                    "threshold", "BLOCK_NONE"
            ),
            Map.of(
                    "category", "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold", "BLOCK_NONE"
            )
    );

    private final WebClient webClient;
    private final String masterKey;

    public LiteLlmService(
            @Value("${litellm.base-url}") String baseUrl,
            @Value("${litellm.master-key:}") String masterKey
    ) {
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .build();
        this.masterKey = masterKey;
    }

    public String chat(String model, String message) {
        return chat(model, List.of(new LiteLlmMessage("user", message)));
    }

    public String chat(String model, List<LiteLlmMessage> messages) {
        Map<String, Object> body = requestBody(model, false, messages);

        Map<?, ?> response = webClient.post()
                .uri("/v1/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + masterKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block(Duration.ofSeconds(60));

        String answer = extractAnswer(response);
        if (answer.isBlank()) {
            throw new ResponseStatusException(BAD_GATEWAY, "LiteLLM response did not contain an answer");
        }

        return answer;
    }

    public void streamChat(
            String model,
            List<LiteLlmMessage> messages,
            Consumer<String> onToken,
            Runnable onComplete,
            Consumer<Throwable> onError
    ) {
        Map<String, Object> body = requestBody(model, true, messages);

        webClient.post()
                .uri("/v1/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + masterKey)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class)
                .timeout(Duration.ofSeconds(60))
                .map(this::extractStreamingToken)
                .filter(token -> !token.isEmpty())
                .subscribe(onToken, onError, onComplete);
    }

    private List<Map<String, String>> toPayload(List<LiteLlmMessage> messages) {
        List<Map<String, String>> payload = new ArrayList<>();
        payload.add(toPayloadMessage(SYSTEM_INSTRUCTION));
        messages.stream()
                .map(this::toPayloadMessage)
                .forEach(payload::add);
        return payload;
    }

    private Map<String, Object> requestBody(String model, boolean stream, List<LiteLlmMessage> messages) {
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", toPayload(messages));
        if (stream) {
            body.put("stream", true);
        }
        if (isGeminiModel(model)) {
            body.put("safety_settings", GEMINI_SAFETY_SETTINGS);
        }
        return body;
    }

    private boolean isGeminiModel(String model) {
        return model != null && model.toLowerCase().contains("gemini");
    }

    private Map<String, String> toPayloadMessage(LiteLlmMessage message) {
        return Map.of(
                "role", message.role(),
                "content", message.content()
        );
    }

    private String extractStreamingToken(String chunk) {
        StringBuilder token = new StringBuilder();
        for (String line : chunk.split("\\R")) {
            if (line.isEmpty() || line.equals("data: [DONE]") || line.equals("[DONE]")) {
                continue;
            }

            String normalized = line;
            if (normalized.startsWith("data:")) {
                normalized = normalized.substring(5);
                if (normalized.startsWith(" ") && normalized.startsWith("{", 1)) {
                    normalized = normalized.substring(1);
                }
            }

            token.append(extractContentField(normalized));
        }
        return token.toString();
    }

    private String extractContentField(String json) {
        String marker = "\"content\"";
        int markerIndex = json.indexOf(marker);
        if (markerIndex < 0) {
            return "";
        }

        int colonIndex = json.indexOf(':', markerIndex + marker.length());
        if (colonIndex < 0) {
            return "";
        }

        int startQuote = json.indexOf('"', colonIndex + 1);
        if (startQuote < 0) {
            return "";
        }

        StringBuilder value = new StringBuilder();
        boolean escaped = false;
        for (int i = startQuote + 1; i < json.length(); i++) {
            char current = json.charAt(i);
            if (escaped) {
                value.append(switch (current) {
                    case 'n' -> '\n';
                    case 'r' -> '\r';
                    case 't' -> '\t';
                    case '"', '\\', '/' -> current;
                    default -> current;
                });
                escaped = false;
            } else if (current == '\\') {
                escaped = true;
            } else if (current == '"') {
                return value.toString();
            } else {
                value.append(current);
            }
        }
        return "";
    }

    private String extractAnswer(Map<?, ?> response) {
        if (response == null) {
            return "";
        }

        Object choicesValue = response.get("choices");
        if (!(choicesValue instanceof List<?> choices) || choices.isEmpty()) {
            return "";
        }

        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?> choice)) {
            return "";
        }

        Object messageValue = choice.get("message");
        if (!(messageValue instanceof Map<?, ?> message)) {
            return "";
        }

        Object content = message.get("content");
        return content instanceof String text ? text : "";
    }
}
