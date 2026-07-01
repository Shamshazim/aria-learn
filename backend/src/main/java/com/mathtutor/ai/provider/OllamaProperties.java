package com.mathtutor.ai.provider;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.ai.ollama")
public class OllamaProperties {

    private String baseUrl = "http://localhost:11434";
    private String teachModel = "qwen2.5:7b";
    private String fastModel = "qwen2.5:3b";
    private int timeoutSeconds = 120;

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getTeachModel() { return teachModel; }
    public void setTeachModel(String teachModel) { this.teachModel = teachModel; }
    public String getFastModel() { return fastModel; }
    public void setFastModel(String fastModel) { this.fastModel = fastModel; }
    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }

    public String modelFor(ModelTier tier) {
        return tier == ModelTier.FAST ? fastModel : teachModel;
    }
}
