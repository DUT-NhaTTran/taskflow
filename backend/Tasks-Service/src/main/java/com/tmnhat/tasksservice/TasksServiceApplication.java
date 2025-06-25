package com.tmnhat.tasksservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan(basePackages = {"com.tmnhat.tasksservice", "com.tmnhat.common"})
public class TasksServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(TasksServiceApplication.class, args);
    }

}
