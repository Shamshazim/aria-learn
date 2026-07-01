package com.mathtutor.ai.prompt;

import com.mathtutor.ai.provider.ModelTier;
import com.mathtutor.common.AiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolves a named prompt template against a set of variables.
 * Variables use {{name}} syntax. A missing required variable fails fast.
 */
@Service
public class PromptRegistry {

    private static final Pattern VAR = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*}}");

    private final PromptTemplateRepository repository;

    public PromptRegistry(PromptTemplateRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public ResolvedPrompt resolve(String name, Map<String, String> variables) {
        PromptTemplate template = repository.findByNameAndActiveTrue(name)
                .orElseThrow(() -> new AiException("No active prompt template named '" + name + "'"));

        String system = substitute(template.getSystemPrompt(), variables, name);
        String user = substitute(template.getUserPromptTemplate(), variables, name);

        return new ResolvedPrompt(
                template.getName(),
                template.getVersion(),
                system,
                user,
                ModelTier.valueOf(template.getModelTier()),
                template.getTemperature(),
                template.getMaxTokens(),
                template.isJsonMode());
    }

    private String substitute(String text, Map<String, String> variables, String promptName) {
        Matcher matcher = VAR.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1);
            String value = variables.get(key);
            if (value == null) {
                throw new AiException("Prompt '" + promptName + "' requires variable '" + key + "' but it was not provided");
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }
}
