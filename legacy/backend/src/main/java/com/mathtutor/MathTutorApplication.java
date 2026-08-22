package com.mathtutor;

import com.mathtutor.ai.provider.OllamaProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties(OllamaProperties.class)
public class MathTutorApplication {
    public static void main(String[] args) {
        SpringApplication.run(MathTutorApplication.class, args);
    }
}
