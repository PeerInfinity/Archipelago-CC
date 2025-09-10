from worlds.generic.Rules import add_rule, set_rule

def set_rules(world_instance) -> None:
    world = world_instance.multiworld
    player = world_instance.player
    
    set_rule(world.get_entrance("ToStaticWebsite", player),
             lambda state: state.has("HTML", player) and state.has("CSS", player) and 
             (state.has("JavaScript Basics", player) or state.has("Git", player) or state.has("Server Basics", player)))
    
    set_rule(world.get_location("Learn CSS", player),
             lambda state: state.has("HTML", player))
    
    set_rule(world.get_location("Learn Design Systems", player),
             lambda state: state.has("CSS", player))
    
    set_rule(world.get_location("Learn DOM Manipulation", player),
             lambda state: state.has("JavaScript Basics", player))
    
    set_rule(world.get_location("Learn Algorithms", player),
             lambda state: state.has("JavaScript Basics", player))
    
    set_rule(world.get_location("Learn File I/O", player),
             lambda state: state.has("Server Basics", player))
    
    set_rule(world.get_location("Learn HTTP Basics", player),
             lambda state: state.has("Server Basics", player))
    
    set_rule(world.get_location("Learn Package Managers", player),
             lambda state: state.has("Command Line", player))
    
    set_rule(world.get_entrance("ToReactRoute", player),
             lambda state: state.has("DOM Manipulation", player))
    
    set_rule(world.get_entrance("ToVanillaRoute", player),
             lambda state: state.has("Algorithms", player))
    
    set_rule(world.get_location("React Components", player),
             lambda state: state.has("React", player))
    
    set_rule(world.get_location("Redux", player),
             lambda state: state.has("Frontend Framework", player))
    
    set_rule(world.get_location("Vue Components", player),
             lambda state: state.has("Vue", player))
    
    set_rule(world.get_location("Vuex", player),
             lambda state: state.has("Frontend Framework", player))
    
    set_rule(world.get_location("Custom State System", player),
             lambda state: state.has("Frontend Framework", player))
    
    set_rule(world.get_entrance("ToExpressRoute", player),
             lambda state: state.has("JavaScript Basics", player))
    
    set_rule(world.get_entrance("ToDjangoRoute", player),
             lambda state: state.has("Server Basics", player))
    
    set_rule(world.get_entrance("ToFlaskRoute", player),
             lambda state: state.has("Server Basics", player))
    
    set_rule(world.get_location("Build REST APIs", player),
             lambda state: state.has("Express", player))
    
    set_rule(world.get_location("MongoDB Integration", player),
             lambda state: state.has("REST APIs", player))
    
    set_rule(world.get_location("Django REST Framework", player),
             lambda state: state.has("Django", player))
    
    set_rule(world.get_location("Django ORM", player),
             lambda state: state.has("REST APIs", player))
    
    set_rule(world.get_location("Flask-RESTful", player),
             lambda state: state.has("Flask", player))
    
    set_rule(world.get_location("SQLAlchemy", player),
             lambda state: state.has("REST APIs", player))
    
    set_rule(world.get_location("UI/UX Principles", player),
             lambda state: state.has("Design Systems", player))
    
    set_rule(world.get_location("Responsive Design", player),
             lambda state: state.has("UI/UX", player))
    
    set_rule(world.get_location("Accessibility", player),
             lambda state: state.has("Responsive Design", player))
    
    set_rule(world.get_location("PostgreSQL", player),
             lambda state: state.has("SQL", player))
    
    set_rule(world.get_location("Query Optimization", player),
             lambda state: state.has("Database Basics", player))
    
    set_rule(world.get_location("MongoDB", player),
             lambda state: state.has("NoSQL", player))
    
    set_rule(world.get_location("Indexing Strategies", player),
             lambda state: state.has("Database Basics", player))
    
    set_rule(world.get_entrance("ToInteractiveApp", player),
             lambda state: (state.has("Frontend Framework", player) and state.has("REST APIs", player)) or
             (state.has("State Management", player) and state.has("Database Basics", player)))
    
    set_rule(world.get_location("Sessions", player),
             lambda state: state.has("HTTP Basics", player))
    
    set_rule(world.get_location("JWT", player),
             lambda state: state.has("Sessions", player))
    
    set_rule(world.get_location("OAuth", player),
             lambda state: state.has("JWT", player))
    
    set_rule(world.get_location("Caching", player),
             lambda state: state.has("Database Basics", player) or state.has("REST APIs", player))
    
    set_rule(world.get_location("CDN", player),
             lambda state: state.has("Caching", player))
    
    set_rule(world.get_location("Load Balancing", player),
             lambda state: state.has("CDN", player))
    
    set_rule(world.get_location("Integration Tests", player),
             lambda state: state.has("Unit Tests", player))
    
    set_rule(world.get_location("E2E Tests", player),
             lambda state: state.has("Integration Tests", player))
    
    set_rule(world.get_location("Docker", player),
             lambda state: state.has("Command Line", player))
    
    set_rule(world.get_location("CI/CD", player),
             lambda state: state.has("Docker", player) and state.has("Git", player))
    
    set_rule(world.get_location("Monitoring", player),
             lambda state: state.has("CI/CD", player))
    
    set_rule(world.get_entrance("ToFullStackHub", player),
             lambda state: state.has("Authentication", player) and
             ((state.has("Performance", player) and state.has("Testing", player)) or
              (state.has("Performance", player) and state.has("DevOps", player)) or
              (state.has("Testing", player) and state.has("DevOps", player))))
    
    set_rule(world.get_location("CORS", player),
             lambda state: state.has("HTTPS", player))
    
    set_rule(world.get_location("Input Validation", player),
             lambda state: state.has("CORS", player))
    
    set_rule(world.get_location("Horizontal Scaling", player),
             lambda state: state.has("Performance", player))
    
    set_rule(world.get_location("Microservices", player),
             lambda state: state.has("Horizontal Scaling", player))
    
    set_rule(world.get_location("Cloud Provider", player),
             lambda state: state.has("DevOps", player))
    
    set_rule(world.get_location("Domain Setup", player),
             lambda state: state.has("Cloud Provider", player))
    
    set_rule(world.get_location("SSL Certificate", player),
             lambda state: state.has("Domain", player) and state.has("HTTPS", player))
    
    set_rule(world.get_entrance("ToProduction", player),
             lambda state: state.has("Security Complete", player) and 
             state.has("Scaling Complete", player) and 
             state.has("Deployment Complete", player))