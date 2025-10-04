-- Interest Tagging System Database Schema
-- This extends the existing Advotecate database with comprehensive interest tagging

-- ===== INTEREST CATEGORIES TABLE =====
-- High-level interest categories (Climate, Healthcare, Education, etc.)
CREATE TABLE interest_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon_name VARCHAR(100) NOT NULL, -- Lucide icon name
    color_hex VARCHAR(7) NOT NULL,   -- #10B981 format
    color_bg VARCHAR(7) NOT NULL,    -- #D1FAE5 format
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===== INTEREST TAGS TABLE =====
-- Detailed tags under categories (Solar Power, Universal Healthcare, etc.)
CREATE TABLE interest_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon_name VARCHAR(100), -- Optional specific icon override
    color_override VARCHAR(7), -- Optional color override
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}', -- Extensible properties like policy areas, urgency, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, slug) -- Unique slug within category
);

-- ===== USER INTERESTS TABLE =====
-- Tracks which interests users have selected and their priority levels
CREATE TABLE user_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5), -- 1-5 scale
    is_active BOOLEAN DEFAULT TRUE,
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tag_id) -- Each user can select each tag only once
);

-- ===== ENTITY TAGS TABLE =====
-- Universal tagging system for all platform entities
CREATE TABLE entity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES interest_tags(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('organization', 'fundraiser', 'event', 'user', 'donation')),
    entity_id UUID NOT NULL, -- References various entity tables
    relevance_score INTEGER NOT NULL DEFAULT 50 CHECK (relevance_score >= 1 AND relevance_score <= 100),
    is_auto_tagged BOOLEAN DEFAULT FALSE, -- Machine vs manual tagging
    tagged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Who tagged this (for manual tags)
    tagged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tag_id, entity_type, entity_id) -- Each entity can have each tag only once
);

-- ===== USER FEED PREFERENCES TABLE =====
-- Stores user's personalization preferences for content feeds
CREATE TABLE user_feed_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_weights JSONB DEFAULT '{}', -- tagId -> weight mapping for algorithm
    content_type_preferences JSONB DEFAULT '{"fundraisers": 50, "events": 50, "organizations": 50}',
    feed_algorithm VARCHAR(20) DEFAULT 'mixed' CHECK (feed_algorithm IN ('latest', 'relevance', 'popularity', 'mixed')),
    show_recommended_content BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id) -- One preference record per user
);

-- ===== PERFORMANCE INDEXES =====

-- Interest categories indexes
CREATE INDEX idx_interest_categories_slug ON interest_categories(slug);
CREATE INDEX idx_interest_categories_is_active ON interest_categories(is_active);
CREATE INDEX idx_interest_categories_sort_order ON interest_categories(sort_order);

-- Interest tags indexes
CREATE INDEX idx_interest_tags_category_id ON interest_tags(category_id);
CREATE INDEX idx_interest_tags_slug ON interest_tags(slug);
CREATE INDEX idx_interest_tags_is_active ON interest_tags(is_active);
CREATE INDEX idx_interest_tags_sort_order ON interest_tags(sort_order);
CREATE INDEX idx_interest_tags_name ON interest_tags(name); -- For search
CREATE INDEX idx_interest_tags_metadata ON interest_tags USING GIN(metadata); -- For metadata queries

-- User interests indexes
CREATE INDEX idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX idx_user_interests_tag_id ON user_interests(tag_id);
CREATE INDEX idx_user_interests_priority ON user_interests(priority);
CREATE INDEX idx_user_interests_is_active ON user_interests(is_active);

-- Entity tags indexes (critical for performance)
CREATE INDEX idx_entity_tags_tag_id ON entity_tags(tag_id);
CREATE INDEX idx_entity_tags_entity_type ON entity_tags(entity_type);
CREATE INDEX idx_entity_tags_entity_id ON entity_tags(entity_id);
CREATE INDEX idx_entity_tags_relevance_score ON entity_tags(relevance_score);
CREATE INDEX idx_entity_tags_type_id ON entity_tags(entity_type, entity_id); -- Composite for entity lookup
CREATE INDEX idx_entity_tags_auto_tagged ON entity_tags(is_auto_tagged);

-- User feed preferences indexes
CREATE INDEX idx_user_feed_preferences_user_id ON user_feed_preferences(user_id);

-- ===== TRIGGER FUNCTIONS FOR UPDATED_AT =====

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_interest_categories_updated_at BEFORE UPDATE
    ON interest_categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_interest_tags_updated_at BEFORE UPDATE
    ON interest_tags FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_interests_updated_at BEFORE UPDATE
    ON user_interests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_entity_tags_updated_at BEFORE UPDATE
    ON entity_tags FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_feed_preferences_updated_at BEFORE UPDATE
    ON user_feed_preferences FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ===== SEED DATA =====

-- Insert default interest categories (from CSV data)
INSERT INTO interest_categories (id, name, slug, description, icon_name, color_hex, color_bg, sort_order) VALUES
('cat_001', 'Climate & Environment', 'climate-environment', 'Environmental protection and climate action initiatives', 'Leaf', '#10B981', '#D1FAE5', 1),
('cat_002', 'Healthcare', 'healthcare', 'Healthcare access and medical policy advocacy', 'Heart', '#EF4444', '#FEE2E2', 2),
('cat_003', 'Education', 'education', 'Educational policy and institutional support', 'GraduationCap', '#3B82F6', '#DBEAFE', 3),
('cat_004', 'Economy & Jobs', 'economy-jobs', 'Economic policy and employment initiatives', 'Briefcase', '#F59E0B', '#FEF3C7', 4),
('cat_005', 'Civil Rights', 'civil-rights', 'Human rights and civil liberties advocacy', 'Scale', '#8B5CF6', '#EDE9FE', 5),
('cat_006', 'Foreign Policy', 'foreign-policy', 'International relations and diplomatic initiatives', 'Globe', '#06B6D4', '#CFFAFE', 6),
('cat_007', 'Immigration', 'immigration', 'Immigration policy and reform advocacy', 'Users', '#84CC16', '#ECFCCB', 7),
('cat_008', 'Criminal Justice', 'criminal-justice', 'Law enforcement and justice system reform', 'Shield', '#6366F1', '#E0E7FF', 8),
('cat_009', 'Technology & Privacy', 'technology-privacy', 'Digital rights and technology policy', 'Smartphone', '#EC4899', '#FCE7F3', 9),
('cat_010', 'Social Issues', 'social-issues', 'Community welfare and social justice initiatives', 'Home', '#14B8A6', '#CCFBF1', 10);

-- Insert sample interest tags
INSERT INTO interest_tags (id, category_id, name, slug, description, icon_name, sort_order, metadata) VALUES
-- Climate & Environment tags
('tag_001', 'cat_001', 'Renewable Energy', 'renewable-energy', 'Solar, wind and clean energy initiatives', 'Sun', 1, '{"policy_areas": ["energy_grid", "subsidies"]}'),
('tag_002', 'cat_001', 'Climate Change', 'climate-change', 'Global warming and climate adaptation policies', 'CloudRain', 2, '{"urgency": "high", "scope": "global"}'),
('tag_003', 'cat_001', 'Environmental Protection', 'environmental-protection', 'Conservation and ecosystem preservation', 'TreePine', 3, '{"focus": ["wildlife", "forests", "oceans"]}'),

-- Healthcare tags
('tag_006', 'cat_002', 'Universal Healthcare', 'universal-healthcare', 'Healthcare as a human right for all citizens', 'Heart', 1, '{"model": "single_payer"}'),
('tag_007', 'cat_002', 'Prescription Drugs', 'prescription-drugs', 'Affordable medication and drug pricing reform', 'Pill', 2, '{"focus": ["pricing", "access", "imports"]}'),
('tag_008', 'cat_002', 'Mental Health', 'mental-health', 'Mental healthcare access and stigma reduction', 'Brain', 3, '{"services": ["therapy", "crisis_intervention"]}'),

-- Education tags
('tag_011', 'cat_003', 'Public Education', 'public-education', 'K-12 public school funding and quality', 'School', 1, '{"levels": ["elementary", "high_school"]}'),
('tag_012', 'cat_003', 'Higher Education', 'higher-education', 'College affordability and student debt relief', 'GraduationCap', 2, '{"focus": ["tuition", "student_loans"]}'),
('tag_013', 'cat_003', 'Teacher Support', 'teacher-support', 'Teacher pay, working conditions and resources', 'UserCheck', 3, '{"issues": ["salary", "classroom_resources"]}');

-- ===== USEFUL VIEWS =====

-- View for getting tags with their categories
CREATE VIEW v_interest_tags_with_categories AS
SELECT
    t.*,
    c.name as category_name,
    c.slug as category_slug,
    c.icon_name as category_icon,
    c.color_hex as category_color_hex,
    c.color_bg as category_color_bg
FROM interest_tags t
LEFT JOIN interest_categories c ON t.category_id = c.id
WHERE t.is_active = true AND c.is_active = true;

-- View for personalized content scoring
CREATE VIEW v_user_content_relevance AS
SELECT
    ui.user_id,
    et.entity_type,
    et.entity_id,
    AVG(ui.priority * et.relevance_score / 100.0) as relevance_score,
    COUNT(*) as matching_interests
FROM user_interests ui
JOIN entity_tags et ON ui.tag_id = et.tag_id
WHERE ui.is_active = true
GROUP BY ui.user_id, et.entity_type, et.entity_id;

-- ===== EXAMPLE QUERIES =====

-- Get all categories with tag counts
/*
SELECT
    c.*,
    COUNT(t.id) as tag_count
FROM interest_categories c
LEFT JOIN interest_tags t ON c.id = t.category_id AND t.is_active = true
WHERE c.is_active = true
GROUP BY c.id
ORDER BY c.sort_order;
*/

-- Get user's interests with category information
/*
SELECT
    ui.priority,
    t.name as tag_name,
    t.slug as tag_slug,
    c.name as category_name,
    c.color_hex,
    c.icon_name
FROM user_interests ui
JOIN interest_tags t ON ui.tag_id = t.id
JOIN interest_categories c ON t.category_id = c.id
WHERE ui.user_id = $1 AND ui.is_active = true
ORDER BY ui.priority DESC, c.sort_order, t.sort_order;
*/

-- Get personalized content for user
/*
SELECT
    et.entity_type,
    et.entity_id,
    AVG(ui.priority * et.relevance_score / 100.0) as relevance_score
FROM user_interests ui
JOIN entity_tags et ON ui.tag_id = et.tag_id
WHERE ui.user_id = $1 AND ui.is_active = true
GROUP BY et.entity_type, et.entity_id
HAVING AVG(ui.priority * et.relevance_score / 100.0) > 2.0
ORDER BY relevance_score DESC
LIMIT 50;
*/