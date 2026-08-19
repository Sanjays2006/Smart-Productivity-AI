package com.tracker;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

@SpringBootApplication
public class TrackerApplication {

    private static ConfigurableApplicationContext context;

    public static void main(String[] args) {
        context = SpringApplication.run(TrackerApplication.class, args);
    }

    /**
     * Programmatically restarts the Spring Boot context.
     * Launches a separate thread to avoid deadlocks while closing the active context.
     */
    public static void restart() {
        if (context == null) return;
        
        Thread restartThread = new Thread(() -> {
            try {
                // Short sleep to allow the response of the trigger request to be fully flushed to the client
                Thread.sleep(1000);
            } catch (InterruptedException ignored) {}

            System.out.println("🔄 Programmatic Context Reload Initiated...");
            ApplicationArguments appArgs = context.getBean(ApplicationArguments.class);
            context.close();
            context = SpringApplication.run(TrackerApplication.class, appArgs.getSourceArgs());
            System.out.println("🟢 Programmatic Context Reload Completed Successfully!");
        });
        
        restartThread.setDaemon(false);
        restartThread.start();
    }
}
