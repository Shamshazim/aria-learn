package com.mathtutor.config;

import com.mathtutor.auth.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final boolean desktop;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, Environment environment) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.desktop = environment.matchesProfiles("desktop");
    }

    /**
     * In the desktop build this process also serves the user interface, so the HTML, the
     * JavaScript bundle and the SPA's own client-side routes must be fetchable before anyone
     * has signed in — otherwise the login screen itself is behind the login.
     *
     * Serving the shell to an anonymous browser gives nothing away: it is the same public
     * bundle for every install, and every piece of family data behind it is fetched from
     * /api, which this matcher deliberately excludes and which stays authenticated.
     */
    private static final RequestMatcher USER_INTERFACE =
            request -> !request.getRequestURI().startsWith("/api/");

    /**
     * The CORS source is injected rather than called directly, because which one exists
     * depends on the active profile — the desktop build swaps in a deny-everything source.
     * It is qualified by name because Spring MVC contributes a second, unrelated
     * CorsConfigurationSource of its own (the handler mapping introspector).
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           @Qualifier("corsConfigurationSource") CorsConfigurationSource corsSource)
            throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsSource))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers("/api/v1/auth/**").permitAll();
                    // Necessarily open: there is no account to authenticate as until the
                    // first parent is created. SetupService refuses once one exists.
                    auth.requestMatchers("/api/v1/setup/**").permitAll();
                    if (desktop) {
                        auth.requestMatchers(HttpMethod.GET, "/actuator/health").permitAll();
                        auth.requestMatchers(USER_INTERFACE).permitAll();
                    } else {
                        auth.requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll();
                        auth.requestMatchers(HttpMethod.GET, "/actuator/health").permitAll();
                    }
                    auth.anyRequest().authenticated();
                })
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Development only: Vite serves the frontend on its own origin and proxies to us.
     *
     * The desktop build serves the frontend from this process, so it is a single origin and
     * needs no cross-origin permission at all — see {@link #desktopCorsConfigurationSource()}.
     */
    @Bean
    @Profile("!desktop")
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost:3000"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * Grants no origin any cross-origin access. The packaged app loads its UI from this
     * server, so a request carrying an Origin header is by definition not our own UI.
     */
    @Bean("corsConfigurationSource")
    @Profile("desktop")
    public CorsConfigurationSource desktopCorsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", new CorsConfiguration());
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
