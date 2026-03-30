# 📄 Cross-Border Sentinel: Multi-Modal Disinformation Detection System

---

## 🧠 1. Introduction

In the modern information ecosystem, misinformation and disinformation have become critical challenges, especially in the context of geopolitical conflicts and digital media. News spreads rapidly across platforms, often without proper verification, leading to confusion, panic, and manipulation.

To address this, we developed **Cross-Border Sentinel**, an AI-inspired, explainable multi-modal disinformation detection system that evaluates the credibility of news content using both textual and visual signals.

---

## 🎯 2. Objective

The primary goal of this project is:

> To estimate the credibility of news content rather than verifying absolute truth.

The system:
- Analyzes linguistic patterns using NLP  
- Evaluates image authenticity signals  
- Produces a credibility score (0–100)  
- Classifies content into:
  - REAL  
  - FAKE  
  - UNCERTAIN  
- Provides transparent explanations  

---

## ⚙️ 3. System Overview

### 🧩 Input:
- 📰 News text  
- 🖼 Optional image  

### 📊 Output:
- Credibility score (0–100)  
- Classification label  
- Detailed explanation  

---

## 🧠 4. Core Methodology

### 📚 4.1 Natural Language Processing (NLP)

Instead of heavy ML models, the system uses **lightweight, explainable linguistic pattern analysis**.

#### ✅ Credibility Signals:
- Neutral and factual tone  
- Structured journalistic writing  
- Institutional or geopolitical references  
- Attribution language  

#### 🚩 Anomaly Signals:
- Sensational/clickbait language  
- Unverified sourcing  
- Speculative phrasing  
- Excessive capitalization  

---

### ⚖️ 4.2 Realism & Plausibility Detection

Evaluates whether claims are:
- Technologically plausible  
- Logically consistent  
- Proportionate to evidence  

Includes:
- Detection of extreme claims  
- High-impact event validation  
- Evidence requirement rules  

---

### 🌐 4.3 Baseline Journalism Detection

Ensures real news is correctly identified using:
- Policy language detection  
- Institutional references  
- Neutral reporting structure  

---

### 🖼️ 4.4 Image Analysis Module (Multi-Modal)

If image is provided:
- Metadata (EXIF) analysis  
- File integrity checks  
- Compression analysis  
- Context matching with text  

Outputs:
- Authenticity status  
- Context match level  
- Reuse detection  

---

### ⚙️ 4.5 Scoring Mechanism

1. Base score = 50  
2. Apply text analysis  
3. Apply image analysis (if present)  
   - 70% Text  
   - 30% Image  
4. Apply rules:
   - Hard negative rule  
   - High-impact verification rule  

---

## 🧩 5. System Architecture

### 🖥️ Frontend:
- React + Vite  
- Tailwind CSS  

### ⚙️ Backend:
- Node.js + Express  
- Rule-based NLP engine  

### 🗄️ Database:
- PostgreSQL  
- Drizzle ORM  

### 📦 Tools:
- Multer (image upload)  
- Zod (validation)  
- OpenAPI + Orval  

---

## 📜 6. Features

- Explainable AI outputs  
- Multi-modal analysis (text + image)  
- Credibility scoring  
- Signal-level transparency  
- History logging  
- Interactive dashboard  

---

## ⚠️ 7. Limitations

- Does not verify real-world facts directly  
- Rule-based (no trained ML models)  
- Limited image verification  

---

## 🔮 8. Future Work

- Integration of ML models (e.g., BERT)  
- Reverse image search  
- Fact-checking API integration  
- Temporal analysis  

---

## 🏁 9. Conclusion

Cross-Border Sentinel demonstrates that **explainable, rule-based AI systems** can effectively evaluate news credibility without relying on heavy machine learning models.

It balances:
- Fake content detection  
- Real news recognition  
- Uncertainty handling  

---

## 🎤 10. One-Line Summary

> Cross-Border Sentinel is an explainable, multi-modal disinformation detection system that uses NLP-based pattern analysis, realism detection, and visual consistency checks to estimate content credibility.
