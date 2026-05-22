# AUTO-GENERATED — do not edit.
# Generated: 2026-05-22T15:39:22Z
# Run: python3 scripts/generate-indicators.py
# Source: metamodel/3_derived/
#
# Usage:
#   from generated.dt_indicators import DTGroup, DTIndicator
#   derived.get(DTGroup.AGENCY)           # group key
#   indicators.get(DTIndicator.INTEGRAL_AGENCY_INDEX)  # IND code

from __future__ import annotations


class DTGroup:
    """Ключи групп расчётных показателей — для derived.get(DTGroup.X)."""
    INTEGRAL = "3_10_integral"
    DIAGNOSTIC = "3_11_diagnostic"
    AGENCY = "3_1_agency"
    MASTERY = "3_2_mastery"
    CHARACTERISTICS = "3_3_characteristics"
    QUALIFICATION = "3_4_qualification"
    ROLES = "3_5_roles"
    RESOURCEFULNESS = "3_6_resourcefulness"
    COMMUNITY = "3_7_community"
    DEGREE = "3_8_degree"
    AI_USAGE = "3_9_ai_usage"


class DTIndicator:
    """IND-коды индивидуальных показателей (compile-time константы)."""

    # 3_10_integral
    INTEGRAL_AGENCY_INDEX = "IND.3.10.1"  # type=scale, unit=0-100

    # 3_11_diagnostic
    DIAGNOSTIC_STATE = "IND.3.11.01"  # type=categorical
    KEY_MISCONCEPTIONS = "IND.3.11.02"  # type=semantic
    RECOMMENDED_FOCUS = "IND.3.11.03"  # type=semantic
    COGNITIVE_LOAD = "IND.3.11.04"  # type=scale, unit=0-1
    FRUSTRATION_LEVEL = "IND.3.11.05"  # type=scale, unit=0-1

    # 3_1_agency
    AVERAGE_SELF_DEVELOPMENT_HOURS_PER_WEEK = "IND.3.1.01"  # type=temporal, unit=hours/week
    PROPORTION_OF_DAYS_WITH_LEARNING_SLOT = "IND.3.1.02"  # type=frequency, unit=days/week
    SLOT_STABILITY_CONSECUTIVE_DAYS = "IND.3.1.03"  # type=frequency, unit=consecutive_days
    RELAPSE_FREQUENCY = "IND.3.1.04"  # type=frequency, unit=relapses/period
    INITIATIVE_INDEX_STRATEGY_REGULARITY = "IND.3.1.05"  # type=frequency, unit=percent_weeks

    # 3_2_mastery
    PRACTICE_INTENSITY_MASTERY_LEVELS = "IND.3.2.01"  # type=categorical
    WORK_PRODUCTS_INDEX_CREATIVE_PIPELINE = "IND.3.2.02"  # type=frequency, unit=drafts/week
    ACCOUNTED_TIME_RITUAL_COMPLETION = "IND.3.2.03"  # type=temporal, unit=hours/week
    IWE_MULTIPLIER = "IND.3.2.04"  # type=temporal
    WORLDVIEW_EVOLUTION = "IND.3.2.08"  # type=semantic
    HABIT_TRANSFORMATION = "IND.3.2.05"  # type=semantic
    POTENTIAL_GROWTH = "IND.3.2.06"  # type=semantic
    CURRENT_NEGATIVE_HABITS = "IND.3.2.07"  # type=semantic

    # 3_3_characteristics
    REFLECTION_INDEX_NOTES_FREQUENCY = "IND.3.3.01"  # type=frequency, unit=notes/week
    ENVIRONMENT_CHARACTERISTICS_INFOSTREAM_CONTROL = "IND.3.3.02"  # type=semantic
    BEHAVIOR_PATTERNS = "IND.3.3.03"  # type=categorical
    CURRENT_MEMES = "IND.3.3.04"  # type=semantic
    PERSONALITY_CALIBER_SYSTEMIC_INTENT_LEVELS = "IND.3.3.05"  # type=semantic

    # 3_4_qualification
    CREATOR_ROLE_STAGES = "IND.3.4.01"  # type=categorical
    STAGE_CHANGE_HISTORY = "IND.3.4.02"  # type=categorical
    LAST_STAGE_CHANGE_DATE = "IND.3.4.03"  # type=temporal
    QUALIFICATION_CRITERIA_SNAPSHOT = "IND.3.4.04"  # type=semantic

    # 3_5_roles
    TARGET_ROLE_MASTERY = "IND.3.5.01"  # type=categorical
    ROLE_CHECKLIST_PROGRESS = "IND.3.5.02"  # type=frequency, unit=percent
    ROLE_APPLICATION_IN_PROJECTS = "IND.3.5.03"  # type=frequency, unit=projects

    # 3_6_resourcefulness
    RESOURCEFULNESS_INDEX_STATE_PRODUCTIVITY = "IND.3.6.01"  # type=scale, unit=1-5
    WORK_REST_RHYTHM_ADHERENCE = "IND.3.6.02"  # type=scale
    FAULT_TOLERANCE_RECOVERY_SPEED = "IND.3.6.03"  # type=temporal, unit=days
    CURRENT_STATE_REGULATION = "IND.3.6.04"  # type=scale, unit=1-5
    RECOVERY_METHODS_FREQUENCY = "IND.3.6.05"  # type=frequency, unit=times/week
    SUPPORT_METHODS_USED = "IND.3.6.06"  # type=frequency, unit=count/week
    RESTRUCTURING_FLEXIBILITY = "IND.3.6.07"  # type=semantic

    # 3_7_community
    HELP_TO_OTHER_MEMBERS = "IND.3.7.1"  # type=frequency, unit=helps/month
    PUBLICATIONS_AND_CONTENT_CONTRIBUTION = "IND.3.7.2"  # type=frequency, unit=posts/month

    # 3_8_degree
    QUALIFICATION_DEGREE = "IND.3.8.01"  # type=categorical

    # 3_9_ai_usage
    AI_INTERACTION_QUALITY = "IND.3.9.1"  # type=scale, unit=1-5
    AI_RECOMMENDATIONS_ADOPTION = "IND.3.9.2"  # type=frequency, unit=percent
