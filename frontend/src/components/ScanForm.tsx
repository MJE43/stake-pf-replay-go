import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  TextInput,
  NumberInput,
  Select,
  Button,
  Group,
  Text,
  Alert,
  Paper,
  Grid,
  ActionIcon,
  Tooltip,
  Code,
  Card,
  Badge,
  Box,
  Title,
  Container,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEye, IconEyeOff, IconHash, IconAlertCircle, IconKey, IconDice, IconTarget, IconSettings } from '@tabler/icons-react';
import { scanFormSchema, validateGameParams, type ScanFormData } from '../lib/validation';
import { GetGames, HashServerSeed, StartScan } from '../../wailsjs/go/bindings/App';
import { games, bindings } from '../../wailsjs/go/models';

interface GameInfo {
  id: string;
  name: string;
  metric_label: string;
}

export function ScanForm() {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hashPreview, setHashPreview] = useState<string>('');
  const [showHashPreview, setShowHashPreview] = useState(false);
  const [hashLoading, setHashLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm({
    resolver: zodResolver(scanFormSchema),
    defaultValues: {
      serverSeed: '',
      clientSeed: '',
      nonceStart: 0,
      nonceEnd: 1000,
      game: '',
      params: {},
      targetOp: 'ge' as const,
      targetVal: 1,
      tolerance: 0,
      limit: 1000,
      timeoutMs: 300000,
    },
  });

  const watchedGame = watch('game');
  const watchedServerSeed = watch('serverSeed');

  // Load available games on component mount
  useEffect(() => {
    const loadGames = async () => {
      try {
        const gameSpecs = await GetGames();
        const gameInfos: GameInfo[] = gameSpecs.map((spec: games.GameSpec) => ({
          id: spec.id,
          name: spec.name,
          metric_label: spec.metric_label,
        }));
        setGames(gameInfos);
      } catch (error) {
        console.error('Failed to load games:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load available games',
          color: 'red',
        });
      }
    };

    loadGames();
  }, []);

  // Clear game-specific validation errors and set defaults when game changes
  useEffect(() => {
    if (watchedGame) {
      clearErrors('params');
      
      // Set default parameters based on selected game
      switch (watchedGame) {
        case 'dice':
          setValue('params', { target: 50, condition: 'over' });
          break;
        case 'limbo':
          setValue('params', { houseEdge: 0.99 });
          break;
        case 'pump':
          setValue('params', { difficulty: 'expert' });
          break;
        case 'roulette':
          setValue('params', {});
          break;
        default:
          setValue('params', {});
      }
    }
  }, [watchedGame, clearErrors, setValue]);

  // Handle server seed hash preview
  const handleHashPreview = async () => {
    if (!watchedServerSeed.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please enter a server seed first',
        color: 'red',
      });
      return;
    }

    setHashLoading(true);
    try {
      const hash = await HashServerSeed(watchedServerSeed);
      setHashPreview(hash);
      setShowHashPreview(true);
    } catch (error) {
      console.error('Failed to hash server seed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to generate server seed hash',
        color: 'red',
      });
    } finally {
      setHashLoading(false);
    }
  };

  // Handle form submission
  const onSubmit = async (data: any) => {
    setLoading(true);
    
    try {
      // Validate game-specific parameters
      const gameParamsSchema = validateGameParams(data.game, data.params);
      const validatedParams = gameParamsSchema.parse(data.params);

      // Prepare scan request
      const scanRequest = {
        Game: data.game,
        Seeds: {
          Server: data.serverSeed,
          Client: data.clientSeed,
        },
        NonceStart: data.nonceStart,
        NonceEnd: data.nonceEnd,
        Params: validatedParams,
        TargetOp: data.targetOp,
        TargetVal: data.targetVal,
        Tolerance: data.tolerance,
        Limit: data.limit,
        TimeoutMs: data.timeoutMs,
      };

      // Execute scan
      const result = await StartScan(bindings.ScanRequest.createFrom(scanRequest));
      
      notifications.show({
        title: 'Scan Started',
        message: `Scan initiated successfully. Run ID: ${result.RunID}`,
        color: 'green',
      });

      // Navigate to results page
      navigate(`/runs/${result.RunID}`);
    } catch (error: any) {
      console.error('Scan failed:', error);
      
      // Handle validation errors
      if (error.name === 'ZodError') {
        error.errors.forEach((err: any) => {
          setError(err.path.join('.') as keyof ScanFormData, {
            message: err.message,
          });
        });
      } else {
        notifications.show({
          title: 'Scan Failed',
          message: error.message || 'An unexpected error occurred',
          color: 'red',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Render game-specific parameter inputs
  const renderGameParams = () => {
    const selectedGame = games.find(g => g.id === watchedGame);
    if (!selectedGame) return null;

    switch (watchedGame) {
      case 'dice':
        return (
          <Grid>
            <Grid.Col span={6}>
              <Controller
                name="params.target"
                control={control}
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Target"
                    description="Target value for dice roll (0.00 - 99.99)"
                    placeholder="Enter target value"
                    size="md"
                    min={0}
                    max={99.99}
                    step={0.01}
                    decimalScale={2}
                    value={field.value as number}
                    onChange={(value) => {
                      field.onChange(value);
                      setValue('params', { ...watch('params'), target: value });
                    }}
                    error={fieldState.error?.message}
                    styles={{
                      input: { color: 'var(--mantine-color-dark-9)' },
                    }}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Controller
                name="params.condition"
                control={control}
                render={({ field, fieldState }) => (
                  <Select
                    label="Condition"
                    description="Roll over or under the target"
                    placeholder="Select condition"
                    size="md"
                    data={[
                      { value: 'over', label: 'Over' },
                      { value: 'under', label: 'Under' },
                    ]}
                    value={field.value as string}
                    onChange={(value) => {
                      field.onChange(value);
                      setValue('params', { ...watch('params'), condition: value });
                    }}
                    error={fieldState.error?.message}
                    styles={{
                      input: { color: 'var(--mantine-color-dark-9)' },
                      dropdown: { 
                        backgroundColor: 'var(--mantine-color-white)',
                      },
                      option: {
                        color: 'var(--mantine-color-dark-9)',
                        '&[data-selected]': {
                          backgroundColor: 'var(--mantine-color-orange-1)',
                          color: 'var(--mantine-color-orange-9)',
                        },
                        '&:hover': {
                          backgroundColor: 'var(--mantine-color-gray-1)',
                        },
                      },
                    }}
                  />
                )}
              />
            </Grid.Col>
          </Grid>
        );
      
      case 'limbo':
        return (
          <Grid>
            <Grid.Col span={12}>
              <Controller
                name="params.houseEdge"
                control={control}
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="House Edge"
                    description="House edge multiplier (default: 0.99 for 1% house edge)"
                    placeholder="0.99"
                    size="md"
                    min={0.01}
                    max={1}
                    step={0.01}
                    decimalScale={3}
                    value={field.value as number || 0.99}
                    onChange={(value) => {
                      field.onChange(value);
                      setValue('params', { ...watch('params'), houseEdge: value });
                    }}
                    error={fieldState.error?.message}
                    styles={{
                      input: { color: 'var(--mantine-color-dark-9)' },
                    }}
                  />
                )}
              />
            </Grid.Col>
          </Grid>
        );
      
      case 'pump':
        return (
          <Grid>
            <Grid.Col span={12}>
              <Controller
                name="params.difficulty"
                control={control}
                render={({ field, fieldState }) => (
                  <Select
                    label="Difficulty"
                    description="Game difficulty level (affects number of POP tokens and multiplier table)"
                    placeholder="Select difficulty"
                    size="md"
                    data={[
                      { value: 'easy', label: 'Easy (1 POP token)' },
                      { value: 'medium', label: 'Medium (3 POP tokens)' },
                      { value: 'hard', label: 'Hard (5 POP tokens)' },
                      { value: 'expert', label: 'Expert (10 POP tokens)' },
                    ]}
                    value={field.value as string || 'expert'}
                    onChange={(value) => {
                      field.onChange(value);
                      setValue('params', { ...watch('params'), difficulty: value });
                    }}
                    error={fieldState.error?.message}
                    styles={{
                      input: { color: 'var(--mantine-color-dark-9)' },
                      dropdown: { 
                        backgroundColor: 'var(--mantine-color-white)',
                      },
                      option: {
                        color: 'var(--mantine-color-dark-9)',
                        '&[data-selected]': {
                          backgroundColor: 'var(--mantine-color-orange-1)',
                          color: 'var(--mantine-color-orange-9)',
                        },
                        '&:hover': {
                          backgroundColor: 'var(--mantine-color-gray-1)',
                        },
                      },
                    }}
                  />
                )}
              />
            </Grid.Col>
          </Grid>
        );
      
      case 'roulette':
        return (
          <Text size="sm" c="dimmed">
            No additional parameters required for {selectedGame.name}. 
            The game uses European roulette (0-36) with standard color and betting rules.
          </Text>
        );
      
      default:
        return (
          <Text size="sm" c="dimmed">
            No additional parameters required for {selectedGame.name}
          </Text>
        );
    }
  };

  return (
    <Container size="lg" p={0}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="xl">
          {/* Header */}
          <Box className="fade-in">
            <Title order={2} mb="xs" className="text-gradient">
              New Scan Configuration
            </Title>
            <Text c="dimmed" size="sm">
              Configure your provable fairness scan parameters to analyze game outcomes
            </Text>
          </Box>

          {/* Seeds Section */}
          <Card withBorder radius="md" p="lg" className="card-hover fade-in">
            <Group mb="lg" gap="xs">
              <IconKey size={20} color="var(--mantine-color-blue-6)" />
              <Title order={3} c="blue">Seeds Configuration</Title>
              <Badge variant="light" color="blue" size="sm">Required</Badge>
            </Group>
            
            <Stack gap="lg">
              {/* Server Seed with Hash Preview */}
              <Box>
                <Group align="end" gap="xs">
                  <TextInput
                    label="Server Seed"
                    description="The unhashed server seed from the casino (never share this publicly)"
                    placeholder="Enter server seed (e.g., 1234567890abcdef...)"
                    required
                    size="md"
                    style={{ flex: 1 }}
                    {...register('serverSeed')}
                    error={errors.serverSeed?.message}
                    rightSection={
                      watchedServerSeed && watchedServerSeed.length > 0 ? (
                        <Text size="xs" c="green">✓</Text>
                      ) : null
                    }
                  />
                  <Tooltip label="Generate server seed hash preview">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      size="xl"
                      onClick={handleHashPreview}
                      loading={hashLoading}
                      disabled={!watchedServerSeed.trim()}
                    >
                      <IconHash size={20} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={showHashPreview ? 'Hide hash preview' : 'Show hash preview'}>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      size="xl"
                      onClick={() => setShowHashPreview(!showHashPreview)}
                      disabled={!hashPreview}
                    >
                      {showHashPreview ? <IconEyeOff size={20} /> : <IconEye size={20} />}
                    </ActionIcon>
                  </Tooltip>
                </Group>
                
                {showHashPreview && hashPreview && (
                  <Paper p="md" mt="md" bg="blue.0" withBorder radius="md">
                    <Text size="sm" fw={500} mb="xs" c="blue.7">Server Seed Hash (SHA256):</Text>
                    <Code block c="blue.8" bg="blue.1" p="sm">{hashPreview}</Code>
                  </Paper>
                )}
              </Box>

              {/* Client Seed */}
              <TextInput
                label="Client Seed"
                description="Your client seed used for the bets"
                placeholder="Enter client seed (e.g., myseed123)"
                size="md"
                required
                {...register('clientSeed')}
                error={errors.clientSeed?.message}
              />
            </Stack>
          </Card>

          {/* Nonce Range Section */}
          <Card withBorder radius="md" p="lg" className="card-hover fade-in">
            <Group mb="lg" gap="xs">
              <IconSettings size={20} color="var(--mantine-color-green-6)" />
              <Title order={3} c="green">Nonce Range</Title>
              <Badge variant="light" color="green" size="sm">Scan Scope</Badge>
            </Group>
            
            <Stack gap="md">
              <Grid>
                <Grid.Col span={6}>
                  <Controller
                    name="nonceStart"
                    control={control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Start Nonce"
                        description="First nonce to scan"
                        placeholder="0"
                        size="md"
                        min={0}
                        thousandSeparator=","
                        value={field.value as number}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                        styles={{
                          input: { color: 'var(--mantine-color-dark-9)' },
                        }}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Controller
                    name="nonceEnd"
                    control={control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="End Nonce"
                        description="Last nonce to scan (max range: 1,500,000)"
                        placeholder="1000"
                        size="md"
                        min={0}
                        max={1500000}
                        thousandSeparator=","
                        value={field.value as number}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                        styles={{
                          input: { color: 'var(--mantine-color-dark-9)' },
                        }}
                      />
                    )}
                  />
                </Grid.Col>
              </Grid>
              
              {/* Nonce Range Info */}
              {watch('nonceStart') !== undefined && watch('nonceEnd') !== undefined && (
                <Paper p="sm" bg="green.0" withBorder radius="sm">
                  <Text size="sm" c="green.8">
                    <strong>Range:</strong> {(watch('nonceEnd') - watch('nonceStart')).toLocaleString()} nonces
                    {watch('nonceEnd') - watch('nonceStart') > 1500000 && (
                      <Text component="span" c="red" ml="sm">
                        ⚠️ Exceeds maximum range of 1,500,000
                      </Text>
                    )}
                  </Text>
                </Paper>
              )}
            </Stack>
          </Card>

          {/* Game Selection Section */}
          <Card withBorder radius="md" p="lg" className="card-hover fade-in">
            <Group mb="lg" gap="xs">
              <IconDice size={20} color="var(--mantine-color-orange-6)" />
              <Title order={3} c="orange">Game Configuration</Title>
              <Badge variant="light" color="orange" size="sm">Game Type</Badge>
            </Group>
            
            <Stack gap="lg">
              <Controller
                name="game"
                control={control}
                render={({ field, fieldState }) => (
                  <Select
                    label="Game Type"
                    description="Select the game you want to analyze"
                    placeholder="Choose a game..."
                    size="md"
                    required
                    data={games.map(game => ({
                      value: game.id,
                      label: `${game.name} (${game.metric_label})`,
                    }))}
                    value={field.value as string}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    styles={{
                      input: { color: 'var(--mantine-color-dark-9)' },
                      dropdown: { 
                        backgroundColor: 'var(--mantine-color-white)',
                      },
                      option: {
                        color: 'var(--mantine-color-dark-9)',
                        '&[data-selected]': {
                          backgroundColor: 'var(--mantine-color-orange-1)',
                          color: 'var(--mantine-color-orange-9)',
                        },
                        '&:hover': {
                          backgroundColor: 'var(--mantine-color-gray-1)',
                        },
                      },
                    }}
                  />
                )}
              />

              {/* Game-specific Parameters */}
              {watchedGame && (
                <Paper p="lg" bg="orange.0" withBorder radius="md">
                  <Group mb="md" gap="xs">
                    <Text size="md" fw={600} c="orange.8">
                      {games.find(g => g.id === watchedGame)?.name} Parameters
                    </Text>
                    <Badge variant="filled" color="orange" size="xs">Game Specific</Badge>
                  </Group>
                  {renderGameParams()}
                </Paper>
              )}
            </Stack>
          </Card>

          {/* Target Configuration Section */}
          <Card withBorder radius="md" p="lg" className="card-hover fade-in">
            <Group mb="lg" gap="xs">
              <IconTarget size={20} color="var(--mantine-color-violet-6)" />
              <Title order={3} c="violet">Target Conditions</Title>
              <Badge variant="light" color="violet" size="sm">Filter Results</Badge>
            </Group>
            
            <Grid>
              <Grid.Col span={4}>
                <Controller
                  name="targetOp"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Select
                      label="Comparison Operator"
                      description="How to compare results"
                      size="md"
                      data={[
                        { value: 'ge', label: 'Greater than or equal (≥)' },
                        { value: 'gt', label: 'Greater than (>)' },
                        { value: 'eq', label: 'Equal to (=)' },
                        { value: 'le', label: 'Less than or equal (≤)' },
                        { value: 'lt', label: 'Less than (<)' },
                      ]}
                      value={field.value as string}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                      styles={{
                        input: { color: 'var(--mantine-color-dark-9)' },
                        dropdown: { 
                          backgroundColor: 'var(--mantine-color-white)',
                        },
                        option: {
                          color: 'var(--mantine-color-dark-9)',
                          '&[data-selected]': {
                            backgroundColor: 'var(--mantine-color-violet-1)',
                            color: 'var(--mantine-color-violet-9)',
                          },
                          '&:hover': {
                            backgroundColor: 'var(--mantine-color-gray-1)',
                          },
                        },
                      }}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Controller
                  name="targetVal"
                  control={control}
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label="Target Value"
                      description="Value to compare against"
                      placeholder="1.00"
                      size="md"
                      min={0}
                      step={0.01}
                      decimalScale={2}
                      value={field.value as number}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                      styles={{
                        input: { color: 'var(--mantine-color-dark-9)' },
                      }}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Controller
                  name="tolerance"
                  control={control}
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label="Tolerance"
                      description="Acceptable variance (optional)"
                      placeholder="0.00"
                      size="md"
                      min={0}
                      step={0.01}
                      decimalScale={2}
                      value={field.value as number}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                      styles={{
                        input: { color: 'var(--mantine-color-dark-9)' },
                      }}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>
          </Card>

          {/* Advanced Settings Section */}
          <Card withBorder radius="md" p="lg" bg="gray.0" className="card-hover fade-in">
            <Group mb="lg" gap="xs">
              <IconSettings size={20} color="var(--mantine-color-gray-6)" />
              <Title order={3} c="gray.7">Advanced Settings</Title>
              <Badge variant="light" color="gray" size="sm">Optional</Badge>
            </Group>
            
            <Grid>
              <Grid.Col span={6}>
                <Controller
                  name="limit"
                  control={control}
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label="Result Limit"
                      description="Maximum number of results to return"
                      placeholder="1000"
                      size="md"
                      min={1}
                      max={100000}
                      thousandSeparator=","
                      value={field.value as number}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                      styles={{
                        input: { color: 'var(--mantine-color-dark-9)' },
                      }}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Controller
                  name="timeoutMs"
                  control={control}
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label="Timeout (ms)"
                      description="Maximum scan duration in milliseconds"
                      placeholder="300000"
                      size="md"
                      min={1000}
                      max={3600000}
                      thousandSeparator=","
                      value={field.value as number}
                      onChange={field.onChange}
                      error={fieldState.error?.message}
                      styles={{
                        input: { color: 'var(--mantine-color-dark-9)' },
                      }}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>
          </Card>

          {/* Form Validation Summary */}
          {Object.keys(errors).length > 0 && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
              <Text size="sm" fw={500} mb="xs">Please fix the following validation errors:</Text>
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field}>
                    <Text size="sm">
                      <strong>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> {error?.message as string}
                    </Text>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Scan Configuration Summary */}
          {watchedGame && watch('nonceStart') !== undefined && watch('nonceEnd') !== undefined && Object.keys(errors).length === 0 && (
            <Paper p="md" bg="blue.0" withBorder radius="md">
              <Text size="sm" fw={500} mb="xs" c="blue.8">Scan Configuration Summary</Text>
              <Grid>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Game:</Text>
                  <Text size="sm" fw={500}>{games.find(g => g.id === watchedGame)?.name}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Nonce Range:</Text>
                  <Text size="sm" fw={500}>{(watch('nonceEnd') - watch('nonceStart')).toLocaleString()} nonces</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Target Condition:</Text>
                  <Text size="sm" fw={500}>
                    {watch('targetOp') === 'ge' ? '≥' : 
                     watch('targetOp') === 'gt' ? '>' :
                     watch('targetOp') === 'eq' ? '=' :
                     watch('targetOp') === 'le' ? '≤' : '<'} {watch('targetVal')}
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="xs" c="dimmed">Result Limit:</Text>
                  <Text size="sm" fw={500}>{watch('limit')?.toLocaleString()} hits</Text>
                </Grid.Col>
              </Grid>
            </Paper>
          )}

          {/* Submit Button */}
          <Group justify="flex-end" pt="md">
            <Button
              type="submit"
              size="lg"
              loading={loading || isSubmitting}
              disabled={Object.keys(errors).length > 0}
              leftSection={<IconTarget size={18} />}
              className="btn-gradient"
            >
              {loading ? 'Starting Scan...' : 'Start Scan'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Container>
  );
}