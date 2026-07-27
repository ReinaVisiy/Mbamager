"""
Mbamager AI Communication Service
This module encapsulates all interactions with the configured Google Gemini AI provider.
"""

import json
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from app.core.config import settings
from app.ai.prompts import (
    CATEGORIZATION_PROMPT,
    NARRATIVE_PROMPT,
    ANOMALY_PROMPT,
    SPENDING_INSIGHT_PROMPT,
    EXPLANATION_PROMPT,
    SCAM_ANALYSIS_PROMPT,
    BUDGET_COACH_PROMPT,
    FINANCIAL_ASSISTANT_PROMPT,
    SMS_PARSER_PROMPT,
)

logger = logging.getLogger(__name__)

class AIService:
    """
    Service encapsulating interactions with Google Gemini API to analyze, categorize,
    clean, and extract insights from financial transactions.
    """

    def __init__(self) -> None:
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> genai.Client:
        """
        Lazily initializes the Google GenAI client to prevent crashes on startup if the API key is missing.
        """
        if self._client is None:
            api_key = settings.GEMINI_API_KEY
            if not api_key:
                logger.warning("GEMINI_API_KEY environment variable is not set. Falling back to rule-based mock logic.")
                raise ValueError("GEMINI_API_KEY is not set.")
            self._client = genai.Client(api_key=api_key)
        return self._client

    def _call_gemini_json(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Helper method to call Gemini with a prompt and expect a JSON response.
        """
        try:
            client = self.client
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=settings.GEMINI_TEMPERATURE,
                    max_output_tokens=settings.GEMINI_MAX_TOKENS,
                    response_mime_type="application/json",
                ),
            )
            if response and response.text:
                return json.loads(response.text.strip())
        except Exception as e:
            logger.error(f"Error calling Gemini API: {str(e)}")
        return None

    def categorize_transaction(
        self,
        amount: Decimal,
        direction: str,
        fee: Decimal,
        narrative: str,
        tx_id_external: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Predict the best TransactionCategory for a given transaction.
        """
        prompt = CATEGORIZATION_PROMPT.format(
            amount=str(amount),
            direction=direction,
            fee=str(fee),
            narrative=narrative or "No description",
            tx_id_external=tx_id_external or "None",
            timestamp=timestamp or "None",
        )

        result = self._call_gemini_json(prompt)
        if result and "category" in result:
            confidence = float(result.get("confidence", 0.50))
            return {
                "category": result["category"],
                "confidence": confidence,
            }

        # Safe mock / deterministic fallback if API is unavailable or fails
        fallback_category = "EXPENSE_FOOD"
        if direction == "CREDIT":
            fallback_category = "INCOME_SALARY"
            if "commission" in (narrative or "").lower():
                fallback_category = "INCOME_BUSINESS"
        else:
            if "commission" in (narrative or "").lower() or "fee" in (narrative or "").lower():
                fallback_category = "EXPENSE_COMMISSION"
            elif "taxi" in (narrative or "").lower() or "transport" in (narrative or "").lower():
                fallback_category = "EXPENSE_TRANSPORT"
            elif "school" in (narrative or "").lower() or "tuition" in (narrative or "").lower():
                fallback_category = "EXPENSE_EDUCATION"
            elif "hospital" in (narrative or "").lower() or "medical" in (narrative or "").lower() or "pharmacy" in (narrative or "").lower():
                fallback_category = "EXPENSE_HEALTH"

        return {
            "category": fallback_category,
            "confidence": 0.50,
            "fallback": True,
        }

    def generate_clean_narrative(
        self,
        narrative: str,
        amount: Decimal,
        direction: str,
        tx_id_external: Optional[str] = None,
    ) -> str:
        """
        Generate a concise, human-friendly summary of the raw transaction description.
        """
        if not narrative:
            return f"{direction.title()} transaction of {amount}"

        prompt = NARRATIVE_PROMPT.format(
            narrative=narrative,
            amount=str(amount),
            direction=direction,
            tx_id_external=tx_id_external or "None",
        )

        result = self._call_gemini_json(prompt)
        if result and "clean_narrative" in result:
            return result["clean_narrative"][:50]  # Enforce max 50 characters

        # Fallback
        clean = narrative
        for term in ["momo", "transfer", "external", "txn"]:
            clean = clean.replace(term, "").strip()
        if tx_id_external:
            clean = clean.replace(tx_id_external, "").strip()
        return clean[:50] or f"{direction.title()} transaction"

    def detect_anomaly(
        self,
        amount: Decimal,
        direction: str,
        category: str,
        fee: Decimal,
        narrative: str,
        tx_id_external: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze transaction parameters to flag potential security anomalies, unusual fees, or extreme amounts.
        """
        prompt = ANOMALY_PROMPT.format(
            amount=str(amount),
            direction=direction,
            category=category,
            fee=str(fee),
            narrative=narrative or "No description",
            tx_id_external=tx_id_external or "None",
            timestamp=timestamp or "None",
        )

        result = self._call_gemini_json(prompt)
        if result and "is_anomaly" in result:
            return {
                "is_anomaly": bool(result["is_anomaly"]),
                "explanation": result.get("explanation", "No explanation provided"),
                "anomaly_score": float(result.get("anomaly_score", 0.0)),
            }

        # Fallback
        is_anomaly = False
        explanation = "Transaction fits typical patterns."
        if amount > Decimal("500000"):
            is_anomaly = True
            explanation = "Transaction amount is unusually high."
        elif fee > (amount * Decimal("0.10")):
            is_anomaly = True
            explanation = "Transaction fee is disproportionately high (exceeds 10% of amount)."

        return {
            "is_anomaly": is_anomaly,
            "explanation": explanation,
            "anomaly_score": 0.80 if is_anomaly else 0.10,
            "fallback": True,
        }

    def generate_spending_insight(
        self,
        transactions: List[Dict[str, Any]],
        budgets: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Analyze transaction and budget history to provide holistic dashboard insights and savings recommendations.
        """
        prompt = SPENDING_INSIGHT_PROMPT.format(
            transactions_json=json.dumps(transactions, default=str),
            budgets_json=json.dumps(budgets, default=str),
        )

        result = self._call_gemini_json(prompt)
        if result:
            return result

        # Fallback
        # Calculate a basic deterministic top category and budget warning
        top_cats = {}
        largest_exp = {"narrative": "None", "amount": 0.0}
        budget_warnings = []
        budget_recommendations = []

        for tx in transactions:
            if tx.get("direction") == "DEBIT":
                amt = float(tx.get("amount", 0.0))
                cat = tx.get("category", "EXPENSE_FOOD")
                top_cats[cat] = top_cats.get(cat, 0.0) + amt
                if amt > largest_exp["amount"]:
                    largest_exp = {"narrative": tx.get("narrative", "Expense"), "amount": amt}

        for b in budgets:
            limit = float(b.get("amount_limit", 0.0))
            spent = float(b.get("amount_spent", 0.0))
            if limit > 0 and spent > limit:
                budget_warnings.append(f"Budget for {b.get('category')} has been exceeded!")
                budget_recommendations.append(f"Increase {b.get('category').replace('EXPENSE_', '').title()} budget based on overspending.")
            elif limit > 0 and spent > (limit * 0.8):
                budget_warnings.append(f"Budget for {b.get('category')} is near 80% limit.")
                budget_recommendations.append(f"Reduce {b.get('category').replace('EXPENSE_', '').title()} spending to stay within limits.")

        if not budget_recommendations:
            budget_recommendations.append("Savings target is realistic.")

        sorted_cats = [{"category": k, "amount": v} for k, v in sorted(top_cats.items(), key=lambda x: x[1], reverse=True)]

        return {
            "top_spending_categories": sorted_cats[:3],
            "largest_expense": largest_exp,
            "income_trend": "No significant historical data to determine clear trend.",
            "budget_warnings": budget_warnings or ["All budgets are currently within safe thresholds."],
            "unusual_spending_alerts": ["No immediate security alerts detected."],
            "savings_suggestions": ["Set aside 10% of monthly income to start an emergency savings cushion."],
            "budget_recommendations": budget_recommendations,
            "fallback": True,
        }

    def explain_transaction(
        self,
        amount: Decimal,
        direction: str,
        narrative: str,
        selected_category: str,
        confidence: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Explain why a specific category was selected for a transaction.
        """
        prompt = EXPLANATION_PROMPT.format(
            amount=str(amount),
            direction=direction,
            narrative=narrative or "No description",
            selected_category=selected_category,
            confidence=str(confidence) if confidence is not None else "0.50",
        )

        result = self._call_gemini_json(prompt)
        if result:
            return result

        # Fallback
        return {
            "assigned_category": selected_category,
            "confidence": confidence or 0.50,
            "explanation": f"The category {selected_category} was chosen because it aligns with typical transaction patterns for matching narratives.",
            "alternatives": [
                {
                    "category": "EXPENSE_COMMISSION" if direction == "DEBIT" else "INCOME_BUSINESS",
                    "confidence": 0.20,
                    "reason": "Alternative classification if transaction context is specialized."
                }
            ],
            "fallback": True,
        }

    def analyze_scam_risk(
        self,
        text: str,
        sender: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Assess a free-text SMS/message/link for common Mobile Money scam patterns
        (SENTINEL). Never blocks or acts on anything itself — per Engineering Law 1,
        this is advisory only; the user decides what to do with the assessment.
        """
        prompt = SCAM_ANALYSIS_PROMPT.format(
            sender=sender or "Unknown",
            text=text,
        )

        result = self._call_gemini_json(prompt)
        if result and "is_suspicious" in result:
            risk_level = str(result.get("risk_level", "LOW")).upper()
            if risk_level not in ("LOW", "MEDIUM", "HIGH"):
                risk_level = "LOW"
            return {
                "is_suspicious": bool(result["is_suspicious"]),
                "risk_level": risk_level,
                "risk_score": float(result.get("risk_score", 0.0)),
                "reasons": result.get("reasons", []),
                "recommended_action": result.get(
                    "recommended_action",
                    "Verify independently before acting; never share your PIN or OTP.",
                ),
            }

        # Deterministic keyword-based fallback if Gemini is unavailable or fails.
        body = (text or "").lower()
        signal_groups: Dict[str, list[str]] = {
            "creates urgency or threatens account loss": [
                "urgent", "immediately", "act now", "account will be blocked",
                "account suspended", "expires today", "final notice",
            ],
            "asks for a PIN, OTP, or password": [
                "pin", "otp", "one time password", "verification code", "confirm your code",
            ],
            "claims an unsolicited prize or lottery win": [
                "congratulations", "you have won", "you've won", "claim your prize", "lottery",
            ],
            "impersonates official support or security staff": [
                "customer service", "verify your account", "official agent", "security team",
            ],
            "promises unrealistic investment returns": [
                "double your money", "guaranteed return", "risk-free investment", "high returns",
            ],
            "pressures clicking a link or calling a number right away": [
                "click here", "click the link", "call this number now",
            ],
        }

        matched_reasons: list[str] = []
        for reason, keywords in signal_groups.items():
            if any(kw in body for kw in keywords):
                matched_reasons.append(reason)

        risk_score = min(0.95, 0.18 * len(matched_reasons))
        if risk_score >= 0.6:
            risk_level = "HIGH"
        elif risk_score >= 0.3:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "is_suspicious": len(matched_reasons) > 0,
            "risk_level": risk_level,
            "risk_score": risk_score,
            "reasons": matched_reasons or ["No common scam patterns detected."],
            "recommended_action": (
                "Never share your PIN, OTP, or password with anyone, and verify through "
                "official channels before acting on this message."
                if matched_reasons
                else "No immediate red flags found, but stay cautious with unfamiliar senders."
            ),
            "fallback": True,
        }

    def generate_budget_coaching(
        self,
        category: str,
        limit_amount: Decimal,
        spent_amount: Decimal,
        remaining_amount: Decimal,
        percentage_used: Decimal,
        risk_level: str,
    ) -> Dict[str, Any]:
        """
        Generate friendly, actionable coaching for a single budget (COMPASS).
        Consumes deterministic progress metrics computed by BudgetService —
        per Engineering Law 1, this never calculates or writes budget figures
        itself, it only turns already-computed numbers into plain-language
        guidance.
        """
        prompt = BUDGET_COACH_PROMPT.format(
            category=category,
            limit_amount=str(limit_amount),
            spent_amount=str(spent_amount),
            remaining_amount=str(remaining_amount),
            percentage_used=str(percentage_used),
            risk_level=risk_level,
        )

        result = self._call_gemini_json(prompt)
        if result and "message" in result:
            tips = result.get("tips", [])
            if not isinstance(tips, list):
                tips = [str(tips)]
            return {
                "message": result["message"],
                "tips": tips[:3],
                "encouragement": result.get("encouragement", "Keep going, you've got this!"),
            }

        # Deterministic fallback if Gemini is unavailable or fails.
        category_label = category.replace("EXPENSE_", "").replace("_", " ").title()

        if risk_level == "EXCEEDED":
            message = (
                f"You've gone over your {category_label} budget of {limit_amount} XAF — "
                f"you're now {percentage_used}% in. It happens; the key is adjusting the "
                "next period rather than dwelling on it."
            )
            tips = [
                f"Pause non-essential {category_label} spending until your next budget period starts.",
                "Review the largest transactions in this category to spot one-off vs. recurring costs.",
                "Set a lower daily limit for the rest of the month to avoid compounding the overage.",
            ]
            encouragement = "One tough period doesn't undo your progress — reset and keep tracking."
        elif risk_level == "WARNING":
            message = (
                f"You're at {percentage_used}% of your {category_label} budget "
                f"({spent_amount} of {limit_amount} XAF), with {remaining_amount} XAF left. "
                "You're close to the limit, so a little care now goes a long way."
            )
            tips = [
                f"Slow down on {category_label} purchases for the next few days.",
                "Check if any upcoming recurring payments will land in this category before the period ends.",
                "Move any spare change into savings so it isn't tempting to spend.",
            ]
            encouragement = "You're still in control — small adjustments now will keep you on track."
        else:
            message = (
                f"You're in good shape on {category_label}: {percentage_used}% used, "
                f"with {remaining_amount} XAF still available out of {limit_amount} XAF."
            )
            tips = [
                "Keep logging transactions as they happen so this stays accurate.",
                f"Consider setting aside part of the remaining {category_label} budget as savings if you don't need it.",
            ]
            encouragement = "Great discipline — keep it up!"

        return {
            "message": message,
            "tips": tips,
            "encouragement": encouragement,
            "fallback": True,
        }

    def generate_assistant_reply(
        self,
        message: str,
        conversation_history: List[Dict[str, str]],
        transactions: List[Dict[str, Any]],
        budgets: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generate a conversational reply for the GUIDE financial assistant chat.
        Only ever reasons about the transactions/budgets it's given (already
        fetched from the real ledger by the caller) — never invents figures,
        and never writes to the ledger itself (Engineering Law 1).
        """
        prompt = FINANCIAL_ASSISTANT_PROMPT.format(
            transactions_json=json.dumps(transactions, default=str),
            budgets_json=json.dumps(budgets, default=str),
            conversation_history_json=json.dumps(conversation_history, default=str),
            message=message,
        )

        result = self._call_gemini_json(prompt)
        if result and "reply" in result:
            follow_ups = result.get("suggested_follow_ups", [])
            if not isinstance(follow_ups, list):
                follow_ups = []
            return {
                "reply": result["reply"],
                "suggested_follow_ups": follow_ups[:3],
            }

        # Deterministic keyword-based fallback if Gemini is unavailable or fails.
        return self._assistant_fallback(message, transactions, budgets)

    @staticmethod
    def _assistant_fallback(
        message: str,
        transactions: List[Dict[str, Any]],
        budgets: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Rule-based reply used only when Gemini is unavailable. Reasons purely
        over the transactions/budgets already computed by the deterministic
        ledger — never estimates or invents figures.
        """
        query = (message or "").lower()
        debit_totals: Dict[str, float] = {}
        largest_expense = {"narrative": "", "amount": 0.0}
        total_income = 0.0
        total_expenses = 0.0

        for tx in transactions:
            amt = float(tx.get("amount", 0.0))
            direction = tx.get("direction", "")
            category = tx.get("category", "EXPENSE_FOOD")
            if direction == "CREDIT":
                total_income += amt
            else:
                total_expenses += amt
                debit_totals[category] = debit_totals.get(category, 0.0) + amt
                if amt > largest_expense["amount"]:
                    largest_expense = {"narrative": tx.get("narrative") or "Expense", "amount": amt}

        top_categories = sorted(debit_totals.items(), key=lambda kv: kv[1], reverse=True)[:3]
        follow_ups = [
            "Where did I spend the most this month?",
            "What should I reduce?",
            "How much did I save?",
        ]

        if any(kw in query for kw in ("most", "largest", "expense")):
            if not top_categories:
                reply = "I don't see any categorized expenses yet — once you have some transactions logged, I can break down where your money is going."
            else:
                lines = [f"Your largest single transaction was {largest_expense['narrative']} at {largest_expense['amount']:.2f} XAF."]
                lines.append("Top spending categories:")
                for cat, amt in top_categories:
                    lines.append(f"- {cat.replace('EXPENSE_', '').title()}: {amt:.2f} XAF")
                reply = "\n".join(lines)
            return {"reply": reply, "suggested_follow_ups": follow_ups}

        if any(kw in query for kw in ("save", "saved", "saving")):
            net = total_income - total_expenses
            reply = (
                f"Based on your logged transactions: income {total_income:.2f} XAF, "
                f"expenses {total_expenses:.2f} XAF, for a net of {net:.2f} XAF."
            )
            return {"reply": reply, "suggested_follow_ups": follow_ups}

        if any(kw in query for kw in ("reduce", "cut", "limit", "warning")):
            warnings = []
            for b in budgets:
                pct = float(b.get("percentage_used", 0.0))
                cat_label = str(b.get("category", "")).replace("EXPENSE_", "").title()
                if pct > 100:
                    warnings.append(f"Your {cat_label} budget is exceeded ({pct:.0f}% used).")
                elif pct >= 80:
                    warnings.append(f"Your {cat_label} budget is close to its limit ({pct:.0f}% used).")
            reply = "\n".join(warnings) if warnings else "All your active budgets are currently within safe limits."
            return {"reply": reply, "suggested_follow_ups": follow_ups}

        # Free-text search across narratives/categories
        words = [w for w in query.split() if len(w) > 2]
        matched = [
            tx for tx in transactions
            if words and any(
                w in (tx.get("narrative", "") or "").lower() or w in (tx.get("category", "") or "").lower()
                for w in words
            )
        ]
        if matched:
            lines = [f"I found {len(matched)} matching transaction(s):"]
            for tx in matched[:5]:
                sign = "+" if tx.get("direction") == "CREDIT" else "-"
                lines.append(f"- {tx.get('narrative') or 'Transaction'}: {sign}{float(tx.get('amount', 0.0)):.2f} XAF")
            reply = "\n".join(lines)
            return {"reply": reply, "suggested_follow_ups": follow_ups}

        reply = (
            "I can help with your accounts, budgets, and spending. Try asking things like "
            "\"Where did I spend the most?\", \"How much did I save?\", or \"What should I reduce?\""
        )
        return {"reply": reply, "suggested_follow_ups": follow_ups, "fallback": True}

    def extract_sms_transaction(self, text: str, sender: str) -> Optional[Dict[str, Any]]:
        """
        Stage 2 (M-PARSE) fallback for SMS transaction extraction. Only called
        when the deterministic regex parser in SMSService.parse_sms() already
        failed to match a message (unusual phrasing, a new operator template,
        French wording, etc.).

        Unlike the other AI methods, there is deliberately NO rule-based
        fallback here if Gemini is unavailable: guessing at a transaction
        amount/direction from unstructured text without any deterministic
        signal to fall back on would risk fabricating a ledger entry, which
        directly violates Engineering Law 1 (AI never owns the ledger). If
        Gemini can't help, this returns None and the message is left
        unprocessed for manual review - a clean failure, not a guess.
        """
        prompt = SMS_PARSER_PROMPT.format(sender=sender or "Unknown", text=text)

        result = self._call_gemini_json(prompt)
        if not result or not result.get("is_transaction"):
            return None

        required = ("amount", "direction", "reference")
        if any(result.get(field) in (None, "") for field in required):
            return None

        try:
            amount = Decimal(str(result["amount"]))
            fee = Decimal(str(result.get("fee") or 0))
        except (ValueError, TypeError, ArithmeticError):
            return None

        if amount <= 0:
            return None

        direction = str(result["direction"]).upper()
        if direction not in ("CREDIT", "DEBIT"):
            return None

        provider = str(result.get("provider") or "OTHER").upper()
        if provider not in ("MTN_MOMO", "ORANGE_MONEY", "CASH", "BANK", "OTHER"):
            provider = "OTHER"

        return {
            "amount": amount,
            "fee": fee,
            "ref": str(result["reference"]),
            "direction": direction,
            "provider": provider,
            "confidence": float(result.get("confidence", 0.5)),
            "ai_extracted": True,
        }
