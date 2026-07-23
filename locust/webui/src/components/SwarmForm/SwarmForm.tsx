import { useMemo, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  FormControl,
  InputLabel,
  Link,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material';
import { AlertColor } from '@mui/material/Alert';
import { connect } from 'react-redux';

import microsoftLogo from 'assets/microsoft_logo.svg';
import CustomInput from 'components/Form/CustomInput';
import Form from 'components/Form/Form';
import NumericField from 'components/Form/NumericField';
import Select from 'components/Form/Select';
import CustomParameters from 'components/SwarmForm/SwarmCustomParameters';
import SwarmUserClassPicker from 'components/SwarmForm/SwarmUserClassPicker';
import { SWARM_STATE } from 'constants/swarm';
import useForm from 'hooks/useForm';
import { usePreviewTestSourceMutation, useStartSwarmMutation } from 'redux/api/swarm';
import { useSelector } from 'redux/hooks';
import { swarmActions } from 'redux/slice/swarm.slice';
import { IRootState } from 'redux/store';
import { ICustomInput } from 'types/form.types';
import {
  IExtraOptions,
  ISwarmFormInput,
  ISwarmState,
  ITestSourcePreviewResponse,
} from 'types/swarm.types';
import { isEmpty } from 'utils/object';

const URL_VALIDATION_REGEX = /^(?:[a-zA-Z][a-zA-Z\d+\-.]*):\/\/[^\s/$.?#].[^\s]*$/;

interface IDispatchProps {
  setSwarm: (swarmPayload: Partial<ISwarmState>) => void;
}

interface IAdvancedOptions extends ICustomInput {
  component?: React.ElementType;
}

export interface ISwarmFormProps extends Pick<ISwarmState, 'allProfiles'> {
  alert?: {
    level?: AlertColor;
    message: string;
  };
  isDisabled?: boolean;
  isEditSwarm?: boolean;
  onFormChange?: (formData: React.ChangeEvent<HTMLFormElement>) => void;
  onFormSubmit?: (inputData: ISwarmFormInput) => void;
  advancedOptions?: IAdvancedOptions[];
}

interface ISwarmForm
  extends
    IDispatchProps,
    Pick<
      ISwarmState,
      | 'allProfiles'
      | 'availableShapeClasses'
      | 'availableUserClasses'
      | 'extraOptions'
      | 'hideCommonOptions'
      | 'shapeUseCommonOptions'
      | 'host'
      | 'overrideHostWarning'
      | 'missingHostWarning'
      | 'isHostRequired'
      | 'profile'
      | 'runTime'
      | 'scheduledTests'
      | 'showUserclassPicker'
      | 'spawnRate'
      | 'numUsers'
      | 'userCount'
    >,
    ISwarmFormProps {}

interface ICanSubmitForm extends ISwarmState {
  isDisabled?: boolean;
}

const canSubmitSwarmForm = ({
  isDisabled,
  isDistributed,
  workerCount,
}: ICanSubmitForm): { isFormDisabled?: boolean; reason?: string } => {
  if (isDisabled) {
    return { isFormDisabled: true };
  }

  if (isDistributed && !workerCount) {
    return {
      isFormDisabled: true,
      reason:
        "You can't start a distributed test before at least one worker processes has connected",
    };
  }

  return {};
};

function SwarmForm({
  allProfiles,
  availableShapeClasses,
  availableUserClasses,
  host,
  extraOptions,
  hideCommonOptions,
  shapeUseCommonOptions,
  numUsers,
  userCount,
  overrideHostWarning,
  missingHostWarning,
  profile,
  runTime,
  setSwarm,
  showUserclassPicker,
  spawnRate,
  alert,
  isDisabled = false,
  isEditSwarm = false,
  isHostRequired,
  onFormChange,
  onFormSubmit,
  advancedOptions,
}: ISwarmForm) {
  const [startSwarm] = useStartSwarmMutation();
  const [previewTestSource, { isLoading: isPreviewingTestSource }] = usePreviewTestSourceMutation();
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedUserClasses, setSelectedUserClasses] = useState(availableUserClasses);
  const [hostValue, setHostValue] = useState(host || '');
  const [locustfileSource, setLocustfileSource] = useState('');
  const [gitAuthToken, setGitAuthToken] = useState('');
  const [queueMode, setQueueMode] = useState<ISwarmFormInput['queueMode']>('start_now');
  const [testSourcePreview, setTestSourcePreview] = useState<ITestSourcePreviewResponse | null>(
    null,
  );
  const [selectedTestFiles, setSelectedTestFiles] = useState<string[]>([]);
  const [sourceUserClasses, setSourceUserClasses] = useState<string[]>([]);
  const swarm = useSelector(({ swarm }) => swarm);
  const { register } = useForm();

  const { reason: formDisabledReason, isFormDisabled } = useMemo(
    () => canSubmitSwarmForm({ isDisabled, ...swarm }),
    [isDisabled, swarm],
  );

  const onStartSwarm = async (inputData: ISwarmFormInput) => {
    const { data } = await startSwarm({
      ...inputData,
      ...(showUserclassPicker && selectedUserClasses ? { userClasses: selectedUserClasses } : {}),
    });

    if (data && data.success) {
      const updatedExtraOptions: IExtraOptions = Object.fromEntries(
        Object.entries(extraOptions).map(([key, option]) => [
          key,
          {
            ...option,
            defaultValue: (inputData as Record<string, any>)[key] ?? option.defaultValue,
          },
        ]),
      );

      setSwarm({
        state: SWARM_STATE.RUNNING,
        host: inputData.host || host,
        runTime: inputData.runTime,
        ...(data.scheduledTests ? { scheduledTests: data.scheduledTests } : {}),
        extraOptions: updatedExtraOptions,
        spawnRate: inputData.spawnRate,
        userCount: inputData.userCount,
        profile: inputData.profile,
      });
    } else {
      setErrorMessage(data ? data.message : 'An unknown error occurred.');
    }

    if (onFormSubmit) {
      onFormSubmit(inputData);
    }
  };

  const handleSwarmFormChange = (formEvent: React.ChangeEvent<HTMLFormElement>) => {
    if (errorMessage) {
      setErrorMessage('');
    }

    if (onFormChange) {
      onFormChange(formEvent);
    }
  };

  const onShapeClassChange = (event: SelectChangeEvent<unknown>) => {
    if (!shapeUseCommonOptions) {
      const hasSelectedShapeClass = event.target.value !== availableShapeClasses[0];
      setSwarm({
        hideCommonOptions: hasSelectedShapeClass,
      });
    }
  };

  const onPreviewTestSource = async () => {
    setErrorMessage('');

    const { data } = await previewTestSource({ gitAuthToken, locustfileSource });
    if (!data || !data.success) {
      setErrorMessage(data?.message || 'Could not discover tests from source.');
      return;
    }

    setTestSourcePreview(data);
    setSelectedTestFiles(data.files.map(file => file.path));
    setSourceUserClasses(data.userClasses);
  };

  const setSelectedTestFile = (filePath: string, isSelected: boolean) => {
    setSelectedTestFiles(currentFiles =>
      isSelected ? [...currentFiles, filePath] : currentFiles.filter(path => path !== filePath),
    );
  };

  const setSelectedSourceUserClass = (userClass: string, isSelected: boolean) => {
    setSourceUserClasses(currentUserClasses =>
      isSelected
        ? [...currentUserClasses, userClass]
        : currentUserClasses.filter(className => className !== userClass),
    );
  };

  return (
    <Container maxWidth='md' sx={{ my: 2 }}>
      <Typography component='h2' noWrap variant='h6'>
        {isEditSwarm ? 'Edit running load test' : 'Start new load test'}
      </Typography>
      {!isEditSwarm && showUserclassPicker && (
        <Box sx={{ marginBottom: 2, marginTop: 2 }}>
          <SwarmUserClassPicker
            availableUserClasses={availableUserClasses}
            selectedUserClasses={selectedUserClasses}
            setSelectedUserClasses={setSelectedUserClasses}
          />
        </Box>
      )}
      <Form<ISwarmFormInput> onChange={handleSwarmFormChange} onSubmit={onStartSwarm}>
        <Box
          sx={{
            marginBottom: 2,
            marginTop: 2,
            display: 'flex',
            flexDirection: 'column',
            rowGap: 4,
          }}
        >
          {!isEditSwarm && showUserclassPicker && (
            <Select
              label='Shape Class'
              name='shapeClass'
              onChange={onShapeClassChange}
              options={availableShapeClasses}
            />
          )}
          <NumericField
            defaultValue={(hideCommonOptions && '0') || userCount || numUsers || 1}
            disabled={!!hideCommonOptions}
            label='Number of users (peak concurrency)'
            name='userCount'
            required
            title={hideCommonOptions ? 'Disabled for tests using LoadTestShape class' : ''}
          />
          <NumericField
            defaultValue={(hideCommonOptions && '0') || spawnRate || 1}
            disabled={!!hideCommonOptions}
            label='Ramp up (users started/second)'
            name='spawnRate'
            required
            title={hideCommonOptions ? 'Disabled for tests using LoadTestShape class' : ''}
          />
          {!isEditSwarm && (
            <>
              <TextField
                {...register(
                  'host',
                  {
                    match: {
                      pattern: URL_VALIDATION_REGEX,
                      message: 'Please use a valid url format e.g. https://google.com',
                    },
                    level: 'warning',
                  },
                  'onBlur',
                )}
                defaultValue={host}
                label={`Host ${
                  overrideHostWarning
                    ? '(setting this will override the host for the User classes)'
                    : ''
                }`}
                name='host'
                onInput={event => setHostValue((event.target as HTMLInputElement).value)}
                required={isHostRequired}
                value={hostValue || ''}
              />
              <Accordion defaultExpanded={!isEditSwarm}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Test source and run mode</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 3 }}>
                    <TextField
                      label='Locustfile source'
                      name='locustfileSource'
                      onChange={event => setLocustfileSource(event.target.value)}
                      placeholder='git+https://github.com/org/repo.git, s3://bucket/test.py, gs://bucket/test.py'
                      value={locustfileSource}
                    />
                    <TextField
                      label='Git auth token'
                      name='gitAuthToken'
                      onChange={event => setGitAuthToken(event.target.value)}
                      placeholder='Personal access token for private HTTPS repositories'
                      type='password'
                      value={gitAuthToken}
                    />
                    {selectedTestFiles.map(filePath => (
                      <input key={filePath} name='selectedTestFiles' type='hidden' value={filePath} />
                    ))}
                    {sourceUserClasses.map(userClass => (
                      <input key={userClass} name='userClasses' type='hidden' value={userClass} />
                    ))}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        disabled={!locustfileSource || isPreviewingTestSource}
                        onClick={onPreviewTestSource}
                        type='button'
                        variant='outlined'
                      >
                        Discover tests
                      </Button>
                      {!!testSourcePreview?.files.length && (
                        <>
                          <Button
                            onClick={() =>
                              setSelectedTestFiles(testSourcePreview.files.map(file => file.path))
                            }
                            type='button'
                          >
                            Select files
                          </Button>
                          <Button onClick={() => setSelectedTestFiles([])} type='button'>
                            Deselect files
                          </Button>
                          <Button
                            onClick={() => setSourceUserClasses(testSourcePreview.userClasses)}
                            type='button'
                          >
                            Select classes
                          </Button>
                          <Button onClick={() => setSourceUserClasses([])} type='button'>
                            Deselect classes
                          </Button>
                        </>
                      )}
                    </Box>
                    {!!testSourcePreview?.files.length && (
                      <Box sx={{ display: 'grid', gap: 2 }}>
                        <Typography variant='subtitle2'>Test files</Typography>
                        {testSourcePreview.files.map(file => (
                          <Box
                            key={file.path}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 1,
                            }}
                          >
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={selectedTestFiles.includes(file.path)}
                                  onChange={event =>
                                    setSelectedTestFile(file.path, event.target.checked)
                                  }
                                />
                              }
                              label={file.path}
                            />
                            {!!file.userClasses.length && (
                              <Typography color='text.secondary' variant='caption'>
                                {file.userClasses.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        ))}
                        {!!testSourcePreview.userClasses.length && (
                          <Box sx={{ display: 'grid', gap: 1 }}>
                            <Typography variant='subtitle2'>User classes</Typography>
                            {testSourcePreview.userClasses.map(userClass => (
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={sourceUserClasses.includes(userClass)}
                                    onChange={event =>
                                      setSelectedSourceUserClass(userClass, event.target.checked)
                                    }
                                  />
                                }
                                key={userClass}
                                label={userClass}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    )}
                    <FormControl>
                      <InputLabel htmlFor='queueMode' shrink>
                        Run mode
                      </InputLabel>
                      <Box
                        component='select'
                        id='queueMode'
                        name='queueMode'
                        onChange={event =>
                          setQueueMode(event.target.value as ISwarmFormInput['queueMode'])
                        }
                        sx={{
                          appearance: 'auto',
                          backgroundColor: 'background.paper',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          color: 'text.primary',
                          font: 'inherit',
                          mt: 2,
                          px: 1.5,
                          py: 2,
                        }}
                        value={queueMode}
                      >
                        <option value='start_now'>Start now</option>
                        <option value='queue'>Queue after current test</option>
                        <option value='schedule'>Schedule for later</option>
                      </Box>
                    </FormControl>
                    <TextField
                      label='Scheduled start time'
                      name='scheduledStartTime'
                      slotProps={{ inputLabel: { shrink: true } }}
                      type='datetime-local'
                    />
                    {!!swarm.scheduledTests?.length && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 1 }}>
                        <Typography variant='subtitle2'>Queued and scheduled tests</Typography>
                        {swarm.scheduledTests.slice(0, 5).map(test => (
                          <Box
                            key={test.id}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              display: 'grid',
                              gap: 0.5,
                              gridTemplateColumns: '1fr auto',
                              p: 1,
                            }}
                          >
                            <Typography noWrap variant='body2'>
                              {test.locustfileSource || test.host || 'Default locustfile'}
                            </Typography>
                            <Typography color='text.secondary' variant='body2'>
                              {test.status}
                            </Typography>
                            <Typography color='text.secondary' variant='caption'>
                              {test.scheduledStartTime || test.createdAt}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Advanced options</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 4 }}>
                    <TextField
                      defaultValue={runTime}
                      disabled={!!hideCommonOptions}
                      label='Run time (e.g. 20, 20s, 3m, 2h, 1h20m, 3h30m10s, etc.)'
                      name='runTime'
                      sx={{ width: '100%' }}
                      title={
                        hideCommonOptions ? 'Disabled for tests using LoadTestShape class' : ''
                      }
                    />
                    <Autocomplete
                      defaultValue={profile}
                      disablePortal
                      freeSolo
                      options={allProfiles && Array.isArray(allProfiles) ? allProfiles : []}
                      renderInput={params => (
                        <TextField
                          {...params}
                          defaultValue={profile}
                          label='Profile'
                          name='profile'
                        />
                      )}
                    />
                    {advancedOptions &&
                      advancedOptions.map(({ component: Component, ...inputProps }, index) =>
                        Component ? (
                          <Component {...inputProps} />
                        ) : (
                          <CustomInput {...inputProps} key={`advanced-parameter-${index}`} />
                        ),
                      )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </>
          )}
          {!!extraOptions && !isEmpty(extraOptions) && (
            <CustomParameters extraOptions={extraOptions} />
          )}
          {alert && !errorMessage && (
            <Alert severity={alert.level || 'info'}>{alert.message}</Alert>
          )}
          {(errorMessage || formDisabledReason) && (
            <Alert severity={'error'}>{errorMessage || formDisabledReason}</Alert>
          )}
          {!isHostRequired && missingHostWarning && !hostValue && (
            <Alert severity='info'>
              One or more User class in your locustfile has no host attribute set. Please provide
              one in the field above.
            </Alert>
          )}
          <Button disabled={isFormDisabled} size='large' type='submit' variant='contained'>
            {isEditSwarm ? 'Update' : 'Start'}
          </Button>
        </Box>
      </Form>
      <Link href='https://aka.ms/loadtesting/quickstart-locust' underline='none'>
        <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.8em' }}>
          <img alt='Microsoft' src={microsoftLogo} style={{ height: '1.2em' }} />
          Want to seamlessly scale your tests and get more insights? Check out Azure Load Testing!
        </Typography>
      </Link>
    </Container>
  );
}

const storeConnector = (
  {
    swarm: {
      allProfiles,
      availableShapeClasses,
      availableUserClasses,
      extraOptions,
      hideCommonOptions,
      shapeUseCommonOptions,
      host,
      numUsers,
      userCount,
      overrideHostWarning,
      missingHostWarning,
      isHostRequired,
      profile,
      runTime,
      scheduledTests,
      spawnRate,
      showUserclassPicker,
    },
  }: IRootState,
  ownProps?: ISwarmFormProps,
) => ({
  allProfiles: allProfiles || ownProps?.allProfiles,
  availableShapeClasses,
  availableUserClasses,
  extraOptions,
  hideCommonOptions,
  shapeUseCommonOptions,
  host,
  overrideHostWarning,
  missingHostWarning,
  isHostRequired,
  profile,
  showUserclassPicker,
  numUsers,
  userCount,
  runTime,
  scheduledTests,
  spawnRate,
});

const actionCreator: IDispatchProps = {
  setSwarm: swarmActions.setSwarm,
};

export default connect(storeConnector, actionCreator)(SwarmForm);
