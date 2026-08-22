package com.mathtutor.desktop;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Serves the built React app from inside the backend jar.
 *
 * In development Vite serves the frontend and proxies /api to this process. In the desktop
 * build there is no Vite, so this process serves both — which also means the frontend's
 * existing relative "/api/v1/..." fetches keep working untouched, and the app is a single
 * origin with no CORS to configure.
 *
 * React Router owns paths like /student and /parent/children that have no matching file on
 * disk. A deep link or a reload on one of those must return index.html and let the router
 * sort it out, rather than 404. API paths are excluded so a wrong URL under /api still
 * returns a real error instead of a page of HTML.
 */
@Configuration
@Profile("desktop")
public class SpaResourceConfig implements WebMvcConfigurer {

    private static final String INDEX = "static/index.html";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        if (resourcePath.startsWith("api/")) {
                            return null;
                        }
                        return new ClassPathResource(INDEX);
                    }
                });
    }
}
