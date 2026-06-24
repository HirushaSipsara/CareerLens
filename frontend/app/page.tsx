'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle, Loader2, TrendingUp } from 'lucide-react'
import BackgroundAnimation from '@/components/background-animation'

type Step = 'input' | 'results'

type Priority = 'High' | 'Medium' | 'Low' | string

interface CareerPath {
  title: string
  match: number
  reason: string
}

interface SkillGap {
  skill: string
  priority?: Priority
}

interface RoadmapStep {
  week: string
  focus: string
  resources?: string
}

interface AnalysisResults {
  career_paths?: CareerPath[]
  skill_gaps?: SkillGap[]
  roadmap?: RoadmapStep[]
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '')

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An error occurred. Please try again.'
}

export default function CareerLens() {
  const [step, setStep] = useState<Step>('input')
  const [cvText, setCvText] = useState('')
  const [skills, setSkills] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<AnalysisResults | null>(null)

  const handleAnalyze = async () => {
    if (!cvText.trim() || !skills.trim()) {
      setError('Please fill in both CV and skills fields.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const response = await fetch(
        API_BASE_URL ? `${API_BASE_URL}/analyze` : '/analyze',
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_text: cvText, skills }),
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to analyze profile (${response.status})`)
      }

      const data = (await response.json()) as AnalysisResults
      setResults(data)
      setStep('results')
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleStartOver = () => {
    setStep('input')
    setCvText('')
    setSkills('')
    setResults(null)
    setError('')
  }

  if (step === 'input') {
    return (
      <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <BackgroundAnimation />
        <div className="relative z-10 w-full max-w-2xl">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="font-heading text-4xl font-bold mb-2 text-primary">
              CareerLens
            </h1>
            <p className="text-muted-foreground text-lg">
              Discover your ideal career path in tech
            </p>
          </div>

          {/* Form */}
          <div className="space-y-8">
            {/* CV Input */}
            <div>
              <label className="block font-heading text-sm font-semibold mb-2 text-foreground">
                Paste Your CV
              </label>
              <textarea
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                placeholder="Paste your CV text here..."
                className="w-full h-40 p-4 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>

            {/* Skills Input */}
            <div>
              <label className="block font-heading text-sm font-semibold mb-2 text-foreground">
                Your Current Skills
              </label>
              <textarea
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="List your current skills (e.g., React, Node.js, Python, etc.)"
                className="w-full h-40 p-4 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-fade-in">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center gap-2 p-4 bg-primary/10 border border-primary/20 rounded-lg animate-fade-in">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-primary font-heading text-sm font-medium">
                  Analyzing your profile...
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full py-3 px-6 bg-primary text-primary-foreground font-heading font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 glow-accent"
            >
              {loading ? 'Analyzing...' : 'Analyze My Career'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Results Page
  return (
    <div className="relative min-h-screen bg-background text-foreground p-4 py-12">
      <BackgroundAnimation />
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-heading text-3xl font-bold mb-2 text-primary">
            Your Career Analysis
          </h1>
          <p className="text-muted-foreground">
            Based on your CV and skills, here are your personalized insights
          </p>
        </div>

        {/* Results Grid */}
        <div className="space-y-8">
          {/* Best-fit Career Paths */}
          {results?.career_paths && (
            <section className="animate-fade-in">
              <h2 className="font-heading text-xl font-bold mb-6 text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Best-fit Career Paths
              </h2>
              <div className="space-y-4">
                {results.career_paths.map((path, idx) => (
                  <div
                    key={idx}
                    className="border-accent-left bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-heading text-lg font-semibold text-foreground">
                        {path.title}
                      </h3>
                      <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-heading font-bold glow-accent">
                        {path.match}%
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm">{path.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skill Gaps */}
          {results?.skill_gaps && (
            <section className="animate-fade-in">
              <h2 className="font-heading text-xl font-bold mb-6 text-foreground flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Skill Gaps to Close
              </h2>
              <div className="flex flex-wrap gap-3">
                {results.skill_gaps.map((gap, idx) => {
                  let tagColor = 'bg-muted text-muted-foreground'
                  if (gap.priority === 'High') {
                    tagColor = 'bg-accent-high/20 text-accent-high border border-accent-high/30'
                  } else if (gap.priority === 'Medium') {
                    tagColor = 'bg-muted/50 text-muted-foreground border border-muted/30'
                  } else {
                    tagColor = 'bg-primary/20 text-primary border border-primary/30'
                  }

                  return (
                    <div
                      key={idx}
                      className={`px-4 py-2 rounded-full text-sm font-heading font-medium ${tagColor} animate-fade-in`}
                    >
                      {gap.skill}
                      {gap.priority && (
                        <span className="ml-2 text-xs font-bold">({gap.priority})</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Roadmap */}
          {results?.roadmap && (
            <section className="animate-fade-in">
              <h2 className="font-heading text-xl font-bold mb-6 text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Your 3-Month Roadmap
              </h2>
              <div className="space-y-0 border border-border rounded-lg overflow-hidden">
                {results.roadmap.map((step, idx) => (
                  <div
                    key={idx}
                    className={`p-6 ${
                      idx !== results.roadmap.length - 1 ? 'border-b border-border' : ''
                    } hover:bg-card/50 transition-colors duration-200`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full font-heading font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
                          {step.week}
                        </h3>
                        <p className="text-muted-foreground text-sm mb-2">{step.focus}</p>
                        {step.resources && (
                          <p className="text-primary text-sm">
                            <span className="font-heading font-semibold">Resources:</span>{' '}
                            {step.resources}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Start Over Button */}
          <div className="pt-8 flex justify-center">
            <button
              onClick={handleStartOver}
              className="px-8 py-3 bg-card border border-border text-foreground font-heading font-semibold rounded-lg hover:bg-card/80 hover:border-primary transition-all duration-200"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
