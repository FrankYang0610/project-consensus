#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Email service module for sending transactional emails.
Uses Resend API for reliable email delivery.
"""

from __future__ import annotations

import logging
import time
from typing import Optional, Dict, Any

from django.conf import settings
from django.template.loader import render_to_string
from django.template import TemplateDoesNotExist
from django.utils.translation import get_supported_language_variant

import resend


logger = logging.getLogger(__name__)


class EmailService:
    """
    Service class for handling all email operations.
    
    Features:
    - Template-based email composition
    - Multi-language support (zh-CN, en)
    - Detailed logging and error handling
    """
    
    def __init__(self):
        """Initialize the email service with Resend API key."""
        self.api_key = getattr(settings, 'RESEND_API_KEY', None)
        self.from_address = getattr(settings, 'EMAIL_FROM_ADDRESS', 'PolyU Life <noreply@polyu.life>')
        self.reply_to = getattr(settings, 'EMAIL_REPLY_TO', 'noreply@polyu.life')
        self.enabled = getattr(settings, 'EMAIL_ENABLED', False)
        
        if self.enabled and not self.api_key:
            logger.error("EMAIL_ENABLED is True but RESEND_API_KEY is not configured")
            raise ValueError("RESEND_API_KEY must be set when EMAIL_ENABLED is True")
        
        if self.api_key:
            resend.api_key = self.api_key
    
    @staticmethod
    def _template_lang(language: Optional[str]) -> str:
        try:
            variant = get_supported_language_variant(language or '', strict=False)
        except Exception:
            variant = 'zh-hans'
        if variant == 'zh-hant':
            return 'zh-Hant'
        if variant == 'en':
            return 'en'
        return 'zh'
    
    def send_verification_code(
        self, 
        email: str, 
        code: str, 
        language: str = 'zh-CN',
        ttl_minutes: int = 15
    ) -> Optional[Dict[str, Any]]:
        """
        Send verification code email to user.
        
        Args:
            email: Recipient email address
            code: 6-digit verification code
            language: Email language (zh-CN or en)
            ttl_minutes: Code validity period in minutes
            
        Returns:
            Resend API response dict if sent, None if email disabled
            
        Raises:
            Exception: If email sending fails
        """
        if not self.enabled:
            logger.warning(
                f"[DEV MODE] Email sending disabled. Code for {email}: {code}"
            )
            return None
        
        start_time = time.time()
        
        try:
            # Map normalized code to template suffix
            lang = EmailService._template_lang(language)
            
            # Render subject from template
            try:
                subject = render_to_string(
                    f'emails/verification_code/subject_{lang}.txt',
                    {'code': code, 'ttl_minutes': ttl_minutes}
                ).strip()
            except TemplateDoesNotExist:
                fallback_lang = 'zh' if lang == 'zh-Hant' else 'en'
                subject = render_to_string(
                    f'emails/verification_code/subject_{fallback_lang}.txt',
                    {'code': code, 'ttl_minutes': ttl_minutes}
                ).strip()
            
            # Render HTML body
            try:
                html_body = render_to_string(
                    f'emails/verification_code/body_{lang}.html',
                    {
                        'code': code,
                        'ttl_minutes': ttl_minutes,
                        'email': email,
                    }
                )
            except TemplateDoesNotExist:
                fallback_lang = 'zh' if lang == 'zh-Hant' else 'en'
                html_body = render_to_string(
                    f'emails/verification_code/body_{fallback_lang}.html',
                    {
                        'code': code,
                        'ttl_minutes': ttl_minutes,
                        'email': email,
                    }
                )
            
            # Render plain text body (fallback)
            try:
                text_body = render_to_string(
                    f'emails/verification_code/body_{lang}.txt',
                    {
                        'code': code,
                        'ttl_minutes': ttl_minutes,
                        'email': email,
                    }
                )
            except TemplateDoesNotExist:
                fallback_lang = 'zh' if lang == 'zh-Hant' else 'en'
                text_body = render_to_string(
                    f'emails/verification_code/body_{fallback_lang}.txt',
                    {
                        'code': code,
                        'ttl_minutes': ttl_minutes,
                        'email': email,
                    }
                )
            
            # Prepare email payload
            payload = {
                'from': self.from_address,
                'to': [email],
                'subject': subject,
                'html': html_body,
                'text': text_body,
                'reply_to': [self.reply_to],
                'tags': [
                    {'name': 'type', 'value': 'verification'},
                    {'name': 'language', 'value': lang}
                ],
            }
            
            # Send email via Resend
            logger.info("Sending verification email", extra={"email": email, "language": lang})
            response = resend.Emails.send(payload)
            
            duration = time.time() - start_time
            logger.info(
                "Verification email sent successfully",
                extra={
                    'email': email,
                    'duration_ms': int(duration * 1000),
                    'language': lang,
                    'resend_id': response.get('id'),
                }
            )
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                "Failed to send verification email",
                extra={
                    'email': email,
                    'duration_ms': int(duration * 1000),
                    'error': str(e),
                    'error_type': type(e).__name__,
                },
                exc_info=True
            )
            raise
    
    def send_password_reset(
        self, 
        email: str, 
        reset_link: str,
        language: str = 'zh-CN',
        timeout_hours: int = 1
    ) -> Optional[Dict[str, Any]]:
        """
        Send password reset email to user.
        
        Args:
            email: Recipient email address
            reset_link: Password reset URL
            language: Email language (zh-CN or en)
            timeout_hours: Link validity period in hours
            
        Returns:
            Resend API response dict if sent, None if email disabled
            
        Raises:
            Exception: If email sending fails
        """
        if not self.enabled:
            logger.warning(
                f"[DEV MODE] Email sending disabled. Reset link for {email}: {reset_link}"
            )
            return None
        
        start_time = time.time()
        
        try:
            # Normalize language code
            lang = EmailService._template_lang(language)
            
            # Render subject from template
            try:
                subject = render_to_string(
                    f'emails/password_reset/subject_{lang}.txt',
                    {'timeout_hours': timeout_hours}
                ).strip()
            except TemplateDoesNotExist:
                fallback_lang = 'zh' if lang == 'zh-Hant' else 'en'
                subject = render_to_string(
                    f'emails/password_reset/subject_{fallback_lang}.txt',
                    {'timeout_hours': timeout_hours}
                ).strip()
            
            # Render HTML body
            try:
                html_body = render_to_string(
                    f'emails/password_reset/body_{lang}.html',
                    {
                        'reset_link': reset_link,
                        'timeout_hours': timeout_hours,
                        'email': email,
                    }
                )
            except TemplateDoesNotExist:
                fallback_lang = 'zh' if lang == 'zh-Hant' else 'en'
                html_body = render_to_string(
                    f'emails/password_reset/body_{fallback_lang}.html',
                    {
                        'reset_link': reset_link,
                        'timeout_hours': timeout_hours,
                        'email': email,
                    }
                )
            
            # Render plain text body (fallback)
            try:
                text_body = render_to_string(
                    f'emails/password_reset/body_{lang}.txt',
                    {
                        'reset_link': reset_link,
                        'timeout_hours': timeout_hours,
                        'email': email,
                    }
                )
            except TemplateDoesNotExist:
                fallback_lang = 'zh' if lang == 'zh-Hant' else 'en'
                text_body = render_to_string(
                    f'emails/password_reset/body_{fallback_lang}.txt',
                    {
                        'reset_link': reset_link,
                        'timeout_hours': timeout_hours,
                        'email': email,
                    }
                )
            
            # Prepare email payload
            payload = {
                'from': self.from_address,
                'to': [email],
                'subject': subject,
                'html': html_body,
                'text': text_body,
                'reply_to': [self.reply_to],
                'tags': [
                    {'name': 'type', 'value': 'password_reset'},
                    {'name': 'language', 'value': lang}
                ],
            }
            
            # Send email via Resend
            logger.info("Sending password reset email", extra={"email": email, "language": lang})
            response = resend.Emails.send(payload)
            
            duration = time.time() - start_time
            logger.info(
                "Password reset email sent successfully",
                extra={
                    'email': email,
                    'duration_ms': int(duration * 1000),
                    'language': lang,
                    'resend_id': response.get('id'),
                }
            )
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                "Failed to send password reset email",
                extra={
                    'email': email,
                    'duration_ms': int(duration * 1000),
                    'error': str(e),
                    'error_type': type(e).__name__,
                },
                exc_info=True
            )
            raise
