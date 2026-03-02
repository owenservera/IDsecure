import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import {
  ResearchSequence,
  ResearchSequenceExecution,
  ResearchStepResult,
} from '@/lib/types/research-sequence';

interface ExecuteSequenceRequest {
  sequence: ResearchSequence;
  subject: {
    name?: string;
    email?: string;
    phone?: string;
    username?: string;
    imageBase64?: string;
    hints?: any;
  };
}

async function executeStep(
  step: any,
  context: Record<string, any>,
  zai: any
): Promise<ResearchStepResult> {
  const startTime = new Date().toISOString();
  
  try {
    let result: any = null;
    const model = process.env.ZAI_MODEL_TEXT || 'glm-4.7-flash';
    const visionModel = process.env.ZAI_MODEL_VISION || 'glm-4.6v-flash';

    switch (step.type) {
      case 'image_analysis':
        if (!context.imageBase64) {
          return {
            stepId: step.id,
            stepName: step.name,
            status: 'skipped',
            startTime,
            endTime: new Date().toISOString(),
            duration: 0,
            error: 'No image provided',
          };
        }

        const imageAnalysisPrompt = `Analyze this image and extract all key data including names, dates, locations, organizations, phone numbers, emails, addresses, ID numbers, text content, QR codes, barcodes, faces, and logos. Respond in JSON format only.`;
        
        const imageCompletion = await zai.chat.completions.create({
          model: visionModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert document analyst. Extract all visible information and respond with valid JSON only.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: imageAnalysisPrompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${context.imageBase64}` } },
              ],
            },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
          max_tokens: 4096,
        });

        result = JSON.parse(imageCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'username_search':
        const usernameSearchPrompt = `Search for username "${context.username || step.parameters.username}" across social media platforms. Return results in JSON format with platform, url, title, and confidence for each found profile.`;
        
        const usernameCompletion = await zai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an OSINT expert. Search for usernames across platforms and return structured JSON results.',
            },
            { role: 'user', content: usernameSearchPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        result = JSON.parse(usernameCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'email_search':
        const emailSearchPrompt = `Search for email "${context.email || step.parameters.email}" across platforms and check for data breaches. Return JSON with profiles and breaches found.`;
        
        const emailCompletion = await zai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an OSINT and data breach expert. Return structured JSON results.',
            },
            { role: 'user', content: emailSearchPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        result = JSON.parse(emailCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'phone_search':
        const phoneSearchPrompt = `Search for phone number "${context.phone || step.parameters.phone}" and find owner information and associated profiles. Return JSON results.`;
        
        const phoneCompletion = await zai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a phone lookup expert. Return structured JSON results.',
            },
            { role: 'user', content: phoneSearchPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        result = JSON.parse(phoneCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'name_search':
        const nameSearchPrompt = `Search for person "${context.name || step.parameters.name}" with context: ${JSON.stringify(context.hints || {})}. Find profiles, locations, and associations. Return JSON results.`;
        
        const nameCompletion = await zai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an investigative researcher. Return structured JSON results.',
            },
            { role: 'user', content: nameSearchPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        result = JSON.parse(nameCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'forensics':
        if (!context.imageBase64) {
          return {
            stepId: step.id,
            stepName: step.name,
            status: 'skipped',
            startTime,
            endTime: new Date().toISOString(),
            error: 'No image provided',
          };
        }

        const forensicsPrompt = `Analyze this image for deep fakes, manipulation, and authenticity. Provide authenticity score, risk level, and detailed findings in JSON format.`;
        
        const forensicsCompletion = await zai.chat.completions.create({
          model: process.env.ZAI_MODEL_VISION_ADVANCED || 'glm-4.6v',
          messages: [
            {
              role: 'system',
              content: 'You are a digital forensics expert. Think step-by-step and return valid JSON.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: forensicsPrompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${context.imageBase64}` } },
              ],
            },
          ],
          temperature: 0.2,
          thinking: { type: 'enabled' },
          response_format: { type: 'json_object' },
          max_tokens: 4096,
        });

        result = JSON.parse(forensicsCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'risk_assessment':
        const riskPrompt = `Assess risk level based on collected data: ${JSON.stringify(context, null, 2).slice(0, 2000)}. Calculate overall risk score (0-100), risk level (low/medium/high/critical), and list risk factors. Return JSON.`;
        
        const riskCompletion = await zai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a risk assessment expert. Provide structured JSON risk analysis.',
            },
            { role: 'user', content: riskPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        result = JSON.parse(riskCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'breach_check':
        const breachPrompt = `Check for data breaches associated with: ${context.email || context.username || context.name}. Include dark web sources. Return JSON with breach records.`;
        
        const breachCompletion = await zai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a data breach expert. Return structured JSON breach data.',
            },
            { role: 'user', content: breachPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        result = JSON.parse(breachCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'dark_web_search':
        const darkWebPrompt = `Search dark web markets, forums, and paste sites for: ${context.email || context.username || context.name}. Return JSON with findings.`;
        
        const darkWebCompletion = await zai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a dark web intelligence expert. Return structured JSON results.',
            },
            { role: 'user', content: darkWebPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        result = JSON.parse(darkWebCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'entity_resolution':
        const entityPrompt = `Resolve and merge duplicate identities from collected data: ${JSON.stringify(context, null, 2).slice(0, 2000)}. Return JSON with resolved entities and confidence scores.`;
        
        const entityCompletion = await zai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an entity resolution expert. Return structured JSON with merged identities.',
            },
            { role: 'user', content: entityPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });

        result = JSON.parse(entityCompletion.choices[0]?.message?.content || '{}');
        break;

      case 'report_generation':
        const reportPrompt = `Generate an investigation report based on: ${JSON.stringify(context, null, 2).slice(0, 3000)}. Include executive summary, findings, risk assessment, and recommendations. Return JSON with report content and format.`;
        
        const reportCompletion = await zai.chat.completions.create({
          model: process.env.ZAI_MODEL_TEXT || 'glm-4.7-flash',
          messages: [
            {
              role: 'system',
              content: 'You are a professional report writer. Create comprehensive investigation reports in JSON format.',
            },
            { role: 'user', content: reportPrompt },
          ],
          temperature: 0.3,
          thinking: { type: 'enabled' },
          response_format: { type: 'json_object' },
          max_tokens: 4096,
        });

        result = JSON.parse(reportCompletion.choices[0]?.message?.content || '{}');
        break;

      default:
        return {
          stepId: step.id,
          stepName: step.name,
          status: 'failed',
          startTime,
          endTime: new Date().toISOString(),
          error: `Unknown step type: ${step.type}`,
        };
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    return {
      stepId: step.id,
      stepName: step.name,
      status: 'completed',
      startTime,
      endTime,
      duration,
      data: result,
      metadata: {
        tokensUsed: result?.usage?.total_tokens,
        model: step.type.includes('image') || step.type.includes('forensics') ? visionModel : model,
      },
    };
  } catch (error) {
    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    return {
      stepId: step.id,
      stepName: step.name,
      status: 'failed',
      startTime,
      endTime,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function shouldRunStep(step: any, previousResults: ResearchStepResult[], context: Record<string, any>): boolean {
  if (!step.enabled) return false;

  const condition = step.condition || { type: 'always' };

  switch (condition.type) {
    case 'always':
      return true;

    case 'on_success':
      const lastResult = previousResults[previousResults.length - 1];
      return lastResult?.status === 'completed';

    case 'on_failure':
      const lastFailedResult = previousResults[previousResults.length - 1];
      return lastFailedResult?.status === 'failed';

    case 'on_data_found':
      const field = condition.field;
      if (!field) return false;
      // Check if field exists in context or previous results
      return !!(context[field] || previousResults.some(r => r.data?.[field]));

    default:
      return true;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ExecuteSequenceRequest = await request.json();
    const { sequence, subject } = body;

    if (!sequence || !sequence.steps || sequence.steps.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid sequence or no steps defined',
      }, { status: 400 });
    }

    const zai = await ZAI.create();
    
    // Initialize execution
    const execution: ResearchSequenceExecution = {
      id: Math.random().toString(36).substring(2, 9),
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      status: 'running',
      subject,
      results: [],
      context: { ...subject },
      startTime: new Date().toISOString(),
    };

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    (async () => {
      try {
        // Send initial status
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'start',
              execution,
            })}\n\n`
          )
        );

        // Execute steps sequentially
        for (let i = 0; i < sequence.steps.length; i++) {
          const step = sequence.steps[i];

          // Check if step should run
          if (!shouldRunStep(step, execution.results, execution.context)) {
            const skippedResult: ResearchStepResult = {
              stepId: step.id,
              stepName: step.name,
              status: 'skipped',
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
            };
            execution.results.push(skippedResult);

            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'step_skipped',
                  result: skippedResult,
                  stepIndex: i,
                })}\n\n`
              )
            );
            continue;
          }

          // Send step start
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'step_start',
                stepId: step.id,
                stepName: step.name,
                stepIndex: i,
                totalSteps: sequence.steps.length,
              })}\n\n`
            )
          );

          // Execute step
          const result = await executeStep(step, execution.context, zai);
          execution.results.push(result);

          // Update context with step output
          if (result.status === 'completed' && result.data) {
            execution.context = {
              ...execution.context,
              ...result.data,
              [`step_${step.id}`]: result.data,
            };
          }

          // Send step result
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'step_complete',
                result,
                stepIndex: i,
                context: execution.context,
              })}\n\n`
            )
          );
        }

        // Mark execution complete
        execution.status = 'completed';
        execution.endTime = new Date().toISOString();
        execution.totalDuration =
          new Date(execution.endTime).getTime() -
          new Date(execution.startTime!).getTime();

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              execution,
            })}\n\n`
          )
        );

        await writer.close();
      } catch (error) {
        execution.status = 'failed';
        execution.endTime = new Date().toISOString();
        execution.error = error instanceof Error ? error.message : 'Unknown error';

        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: execution.error,
              execution,
            })}\n\n`
          )
        );

        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Sequence execution error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sequence execution failed',
    }, { status: 500 });
  }
}
